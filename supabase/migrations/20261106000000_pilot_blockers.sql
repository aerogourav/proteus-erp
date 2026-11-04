-- Pilot blockers (Phase 1 of hardening). Adds to the earlier migrations; none of them is edited.
-- Functions defined earlier are replaced here with "create or replace" where their rules change.
--
--  N1/N2  Drawing records are immutable versions: storage path, file fingerprint (SHA-256), type, link, number and revision
--         never change. Only owners and admins supersede a drawing, through supersede_file() with a reason.
--  N7     Approval is bound to the verified SHA-256 of the file (approve_file(file_id, verified_sha256)); the one-argument
--         approval is withdrawn. Storage objects cannot be overwritten, approved drawings cannot be removed from Storage,
--         and the bucket gets size and type limits.
--  N5/N6  Only the server creates demo companies; the demo flag and expiry never change afterwards. Deleting a company from
--         the app is refused whenever it holds issued records or history, demo or not. The demo purge removes shop-floor
--         logs first so foreign keys cannot stop it. Pilot closure is a separate, audited operator process.
--  N3/N4  Inspections follow a server-stored plan per part and revision with explicit limits. Every characteristic is
--         recorded exactly once; numeric values must be numbers; no usable limit means "needs review"; a review is resolved
--         by an owner or admin with a reason, not by the inspector when another owner or admin exists.

/* ============================== Drawings: immutable versions, hash-bound approval ============================== */

alter table public.files add column if not exists content_sha256 text;
alter table public.files add column if not exists approved_sha256 text;
alter table public.files add column if not exists superseded_by uuid;
alter table public.files add column if not exists superseded_at timestamptz;
alter table public.files add column if not exists superseded_reason text;
alter table public.files drop constraint if exists files_content_sha256_format;
alter table public.files add constraint files_content_sha256_format check (content_sha256 is null or content_sha256 ~ '^[0-9a-f]{64}$');

create or replace function public.files_guard() returns trigger language plpgsql set search_path = '' as $$
begin
  if not public.is_api_role() then return case when tg_op = 'DELETE' then old else new end; end if;
  if tg_op = 'DELETE' then
    if old.doc_type = 'Drawing' then raise exception 'drawings are not deleted; an owner or admin supersedes them with a reason'; end if;
    if old.status = 'Approved' then raise exception 'approved files are not deleted'; end if;
    return old;
  end if;
  if tg_op = 'INSERT' then
    if new.status not in ('Draft', 'In review') or new.approved_by is not null or new.approved_at is not null or new.approved_sha256 is not null
       or new.superseded_by is not null or new.superseded_at is not null or new.superseded_reason is not null then
      raise exception 'new files start in review; approval and superseding go through approve_file() and supersede_file()';
    end if;
    return new;
  end if;
  if (new.company_id, new.storage_path, new.content_sha256, new.doc_type, new.linked_type, new.linked_id, new.number, new.revision, new.created_at)
     is distinct from (old.company_id, old.storage_path, old.content_sha256, old.doc_type, old.linked_type, old.linked_id, old.number, old.revision, old.created_at) then
    raise exception 'file versions are immutable: upload a new version instead of changing this one';
  end if;
  if new.status = 'Superseded' or old.status = 'Superseded'
     or (new.superseded_by, new.superseded_at, new.superseded_reason) is distinct from (old.superseded_by, old.superseded_at, old.superseded_reason) then
    if new.status is distinct from old.status or (new.superseded_by, new.superseded_at, new.superseded_reason) is distinct from (old.superseded_by, old.superseded_at, old.superseded_reason) then
      raise exception 'files are superseded only through supersede_file() by an owner or admin';
    end if;
  end if;
  if new.status = 'Approved' then
    if old.status <> 'Approved' or (new.approved_by, new.approved_at, new.approved_sha256) is distinct from (old.approved_by, old.approved_at, old.approved_sha256) then
      raise exception 'files are approved only through approve_file() with a verified fingerprint';
    end if;
  elsif new.status <> 'Superseded' then
    -- Withdrawing an approval is always allowed; it clears the approval.
    new.approved_by := null;
    new.approved_at := null;
    new.approved_sha256 := null;
  end if;
  return new;
end;
$$;
create trigger files_guard_delete before delete on public.files for each row execute function public.files_guard();

-- The one-argument approval (no fingerprint) is withdrawn.
create or replace function public.approve_file(file_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  raise exception 'approval needs a verified fingerprint: use approve_file(file_id, verified_sha256)';
end;
$$;

/** Approves a file whose SHA-256, checked by the server against the stored object, matches the recorded fingerprint. Owner or admin. */
create function public.approve_file(file_id uuid, verified_sha256 text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  f public.files%rowtype;
begin
  select * into f from public.files where id = file_id for update;
  if not found or not public.is_admin(f.company_id) then raise exception 'only an owner or admin of this company can approve'; end if;
  if f.status = 'Superseded' then raise exception 'a superseded file cannot be approved'; end if;
  if f.content_sha256 is null then raise exception 'this record has no file fingerprint (SHA-256); upload the file to approve it'; end if;
  if lower(trim(coalesce(verified_sha256, ''))) <> f.content_sha256 then raise exception 'the file does not match its recorded fingerprint; upload it again'; end if;
  if f.status = 'Approved' then return; end if;
  update public.files set status = 'Approved', approved_by = auth.uid(), approved_at = now(), approved_sha256 = f.content_sha256 where id = file_id;
  insert into public.activity_log (company_id, module, action, entity_type, entity_id, summary, data)
  values (f.company_id, 'documents', 'approve', 'file', f.id, f.doc_type || ' ' || f.number || ' rev ' || f.revision || ' approved', jsonb_build_object('sha256', f.content_sha256));
end;
$$;

/** Withdraws a file version (for example a drawing revision issued by mistake). Owner or admin, with a reason; logged. */
create function public.supersede_file(file_id uuid, reason text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  f public.files%rowtype;
begin
  select * into f from public.files where id = file_id for update;
  if not found or not public.is_admin(f.company_id) then raise exception 'only an owner or admin of this company can supersede a file'; end if;
  if length(trim(coalesce(reason, ''))) < 5 then raise exception 'give a reason of at least a few words'; end if;
  if f.status = 'Superseded' then return; end if;
  update public.files set status = 'Superseded', approved_by = null, approved_at = null, approved_sha256 = null,
    superseded_by = auth.uid(), superseded_at = now(), superseded_reason = trim(reason) where id = file_id;
  insert into public.activity_log (company_id, module, action, entity_type, entity_id, summary)
  values (f.company_id, 'documents', 'supersede', 'file', f.id, f.doc_type || ' ' || f.number || ' rev ' || f.revision || ' superseded: ' || trim(reason));
end;
$$;

/** Release check: the drawing approval counts only when bound to the file's fingerprint; superseded revisions do not block. */
create or replace function public.release_blockers(target_order uuid) returns text[]
language plpgsql stable set search_path = '' as $$
declare
  o public.production_orders%rowtype;
  sku text;
  d record;
  m record;
  on_hand numeric;
  blockers text[] := '{}';
begin
  select * into o from public.production_orders p where p.id = target_order;
  if not found then return array['Production order not found.']; end if;
  select i.sku into sku from public.items i where i.id = o.item_id;
  select f.number, f.revision, f.status, (f.status = 'Approved' and f.approved_sha256 is not null and f.approved_sha256 = f.content_sha256) as valid into d from public.files f
  where f.company_id = o.company_id and f.doc_type = 'Drawing' and f.linked_type = 'item' and f.linked_id = o.item_id and upper(trim(f.revision)) = upper(trim(o.revision))
  order by (f.status = 'Approved' and f.approved_sha256 is not null and f.approved_sha256 = f.content_sha256) desc, (f.status <> 'Superseded') desc, f.created_at desc limit 1;
  if not found then blockers := blockers || format('No drawing for %s rev %s.', sku, o.revision);
  elsif d.status = 'Approved' and not d.valid then blockers := blockers || format('Drawing %s rev %s is approved without a verified file fingerprint.', d.number, d.revision);
  elsif d.status <> 'Approved' then blockers := blockers || format('Drawing %s rev %s is not approved (%s).', d.number, d.revision, lower(d.status));
  end if;
  for d in select f.number, f.revision from public.files f
    where f.company_id = o.company_id and f.doc_type = 'Drawing' and f.linked_type = 'item' and f.linked_id = o.item_id and f.status <> 'Superseded'
      and public.revision_newer(f.revision, o.revision)
    order by f.revision
  loop
    blockers := blockers || format('Drawing %s revision %s exists; this job is for revision %s. Check the change before continuing.', d.number, d.revision, o.revision);
  end loop;
  if jsonb_array_length(coalesce(o.routing, public.item_routing(o.item_id))) = 0 then blockers := blockers || format('No routing for %s.', sku); end if;
  if o.material_issued_at is null then
    if not exists (select 1 from public.order_materials om where om.order_id = o.id) then blockers := blockers || format('No material for %s.', o.number); end if;
    for m in select om.item_id, om.warehouse_id, om.quantity, i.sku, i.unit from public.order_materials om join public.items i on i.id = om.item_id where om.order_id = o.id loop
      select coalesce(sum(sm.quantity), 0) into on_hand from public.stock_moves sm where sm.item_id = m.item_id and sm.warehouse_id = m.warehouse_id;
      if on_hand < m.quantity then blockers := blockers || format('%s: %s of %s %s in stock.', m.sku, trim_scale(on_hand), trim_scale(m.quantity), m.unit); end if;
    end loop;
  end if;
  return blockers;
end;
$$;

/* ============================== Storage: immutable objects, protected approvals, limits ============================== */

do $$
begin
  if to_regclass('storage.objects') is null then
    return;
  end if;
  -- No update policy: an object is never overwritten (an upload with upsert is refused). A new file is a new path.
  execute 'drop policy if exists boh_company_files_update on storage.objects';
  execute 'drop policy if exists boh_company_files_delete on storage.objects';
  execute $p$create policy boh_company_files_delete on storage.objects for delete to authenticated
    using (bucket_id = 'company-files' and public.is_admin(public.folder_company(objects.name))
      and not exists (select 1 from public.files f where f.storage_path = objects.name and (f.doc_type = 'Drawing' or f.status <> 'Draft')))$p$;
  if to_regclass('storage.buckets') is not null and exists (
    select 1 from information_schema.columns where table_schema = 'storage' and table_name = 'buckets' and column_name = 'allowed_mime_types'
  ) then
    update storage.buckets set file_size_limit = 20971520,
      allowed_mime_types = array['application/pdf', 'image/png', 'image/jpeg', 'image/svg+xml', 'image/vnd.dxf', 'image/vnd.dwg', 'application/dxf', 'application/acad',
                                 'model/step', 'application/step', 'model/iges', 'model/stl']
    where id = 'company-files';
  end if;
end;
$$;

/* ============================== Companies: demo flag, retention, purge ============================== */

/** Creates a company with the caller as owner. Demo sandboxes are created only by the BOH ERP server (service role). */
create or replace function public.create_company(company_name text, company_industry text, demo boolean default false)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  new_id uuid;
  jwt_role text := coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), (nullif(current_setting('request.jwt.claims', true), '')::jsonb) ->> 'role', '');
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if demo and jwt_role <> 'service_role' then raise exception 'demo companies are created by the BOH ERP server'; end if;
  insert into public.companies (name, industry, is_demo, expires_at)
  values (company_name, company_industry, demo, case when demo then now() + interval '7 days' end)
  returning id into new_id;
  insert into public.memberships (company_id, user_id, role) values (new_id, auth.uid(), 'owner');
  return new_id;
end;
$$;

create function public.companies_guard() returns trigger language plpgsql set search_path = '' as $$
begin
  if public.is_api_role() and (new.is_demo, new.expires_at) is distinct from (old.is_demo, old.expires_at) then
    raise exception 'the demo flag and expiry are set by the server only';
  end if;
  return new;
end;
$$;
create trigger companies_guard before update on public.companies for each row execute function public.companies_guard();

-- From the app, a company with issued records or history is never deleted, whether or not it is flagged as a demo.
create or replace function public.companies_keep_records() returns trigger language plpgsql set search_path = '' as $$
begin
  if not public.is_api_role() then return old; end if;
  if exists (select 1 from public.sales_documents d where d.company_id = old.id and d.kind in ('invoice', 'credit_note') and d.status <> 'Draft')
     or exists (select 1 from public.activity_log a where a.company_id = old.id)
     or exists (select 1 from public.audit_history h where h.company_id = old.id and h.table_name <> 'companies' and h.table_name <> 'memberships') then
    raise exception 'this company has issued documents or history; it is closed through the retention process, not deleted';
  end if;
  return old;
end;
$$;

/**
 * Deletes every record of the given companies in dependency order, then the companies. Used only by the demo purge and the
 * operator deletion (both security definer, not callable from the app). Composite foreign keys without cascade would
 * otherwise stop a plain "delete from companies".
 */
create function public.delete_company_records(ids uuid[]) returns int
language plpgsql security definer set search_path = '' as $$
declare
  removed int;
begin
  delete from public.inspections where company_id = any (ids);
  delete from public.operation_logs where company_id = any (ids);
  delete from public.active_operations where company_id = any (ids);
  delete from public.material_lots where company_id = any (ids);
  delete from public.order_materials where company_id = any (ids);
  delete from public.production_orders where company_id = any (ids);
  delete from public.inspection_plans where company_id = any (ids);
  delete from public.routing_operations where company_id = any (ids);
  delete from public.stock_moves where company_id = any (ids);
  delete from public.payments where company_id = any (ids);
  delete from public.sales_lines where company_id = any (ids);
  delete from public.purchase_lines where company_id = any (ids);
  update public.sales_documents set source_id = null where company_id = any (ids) and source_id is not null;
  delete from public.sales_documents where company_id = any (ids);
  update public.purchase_documents set source_id = null where company_id = any (ids) and source_id is not null;
  delete from public.purchase_documents where company_id = any (ids);
  delete from public.files where company_id = any (ids);
  delete from public.projects where company_id = any (ids);
  delete from public.people_pay where company_id = any (ids);
  delete from public.people where company_id = any (ids);
  update public.items set parent_id = null, default_supplier_id = null where company_id = any (ids);
  delete from public.items where company_id = any (ids);
  delete from public.contacts where company_id = any (ids);
  delete from public.warehouses where company_id = any (ids);
  delete from public.companies where id = any (ids);
  get diagnostics removed = row_count;
  delete from public.audit_history where company_id = any (ids);
  return removed;
end;
$$;

/** Deletes expired demo sandboxes, all their records in dependency order, and their audit history. */
create or replace function public.purge_expired_demos() returns int
language plpgsql security definer set search_path = '' as $$
declare
  ids uuid[];
  removed int;
begin
  select coalesce(array_agg(c.id), '{}') into ids from public.companies c where c.is_demo and c.expires_at < now();
  if cardinality(ids) = 0 then return 0; end if;
  removed := public.delete_company_records(ids);
  return removed;
end;
$$;

/* ============================== Pilot closure: audited, operator-run ============================== */

-- One row per step. No foreign key: the evidence of a closure outlives the company. Contains no business data.
create table public.company_closures (
  id bigint generated always as identity primary key,
  company_id uuid not null,
  company_name text not null,
  state text not null check (state in ('requested', 'access_closed', 'deleted')),
  reason text not null,
  actor uuid,
  at timestamptz not null default now(),
  legal_records_deleted boolean not null default false,
  counts jsonb not null default '{}'::jsonb
);
alter table public.company_closures enable row level security;
create policy company_closures_read on public.company_closures for select using (public.is_admin(company_id));
grant select on public.company_closures to authenticated;

/** The owner asks for the company to be closed after the pilot. Nothing is deleted here. */
create function public.request_company_closure(target uuid, reason text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  c public.companies%rowtype;
begin
  select * into c from public.companies where id = target;
  if not found or not public.has_role(target, array['owner']) then raise exception 'only the owner of this company can request its closure'; end if;
  if length(trim(coalesce(reason, ''))) < 5 then raise exception 'give a reason of at least a few words'; end if;
  insert into public.company_closures (company_id, company_name, state, reason, actor) values (c.id, c.name, 'requested', trim(reason), auth.uid());
  insert into public.activity_log (company_id, module, action, entity_type, entity_id, summary)
  values (c.id, 'settings', 'closure_requested', 'company', c.id, 'Closure requested: ' || trim(reason));
end;
$$;

/** Operator step 1: removes every member, so nobody can sign in to the company. Records stay. Not callable from the app. */
create function public.operator_close_access(target uuid, note text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  c public.companies%rowtype;
  removed int;
begin
  select * into c from public.companies where id = target;
  if not found then raise exception 'company not found'; end if;
  if length(trim(coalesce(note, ''))) < 5 then raise exception 'write down why access is closed'; end if;
  delete from public.memberships where company_id = target;
  get diagnostics removed = row_count;
  insert into public.company_closures (company_id, company_name, state, reason, actor, counts)
  values (c.id, c.name, 'access_closed', trim(note), auth.uid(), jsonb_build_object('memberships_removed', removed));
end;
$$;

/**
 * Operator step 2: deletes the company with all its records and its audit history. Not callable from the app.
 * Issued invoices and credit notes are kept unless delete_legal_records is true, which is only for after the legal retention
 * period, on written advice. The closure row (name, reason, counts) is kept as evidence.
 */
create function public.operator_delete_company(target uuid, confirm_name text, delete_legal_records boolean, note text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  c public.companies%rowtype;
  counts jsonb;
begin
  select * into c from public.companies where id = target;
  if not found then raise exception 'company not found'; end if;
  if confirm_name is distinct from c.name then raise exception 'confirm with the exact company name'; end if;
  if length(trim(coalesce(note, ''))) < 5 then raise exception 'write down why the company is deleted and on whose advice'; end if;
  if not delete_legal_records and exists (select 1 from public.sales_documents d where d.company_id = target and d.kind in ('invoice', 'credit_note') and d.status <> 'Draft') then
    raise exception 'issued invoices must be kept for the legal retention period: close access instead, or rerun with delete_legal_records after that period on written advice';
  end if;
  counts := jsonb_build_object(
    'contacts', (select count(*) from public.contacts where company_id = target),
    'items', (select count(*) from public.items where company_id = target),
    'production_orders', (select count(*) from public.production_orders where company_id = target),
    'operation_logs', (select count(*) from public.operation_logs where company_id = target),
    'inspections', (select count(*) from public.inspections where company_id = target),
    'sales_documents', (select count(*) from public.sales_documents where company_id = target),
    'files', (select count(*) from public.files where company_id = target),
    'audit_history', (select count(*) from public.audit_history where company_id = target));
  perform public.delete_company_records(array[target]);
  insert into public.company_closures (company_id, company_name, state, reason, actor, legal_records_deleted, counts)
  values (c.id, c.name, 'deleted', trim(note), auth.uid(), delete_legal_records, counts);
end;
$$;

/* ============================== Inspection plans ============================== */

create table public.inspection_plans (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  item_id uuid not null,
  revision text not null check (length(trim(revision)) > 0),
  position int not null default 0,
  characteristic text not null check (length(trim(characteristic)) > 0),
  kind text not null check (kind in ('numeric', 'attribute')),
  nominal numeric,
  lower_limit numeric,
  upper_limit numeric,
  unit text not null default '',
  required_gauge text not null default '',
  sample_size int not null default 1 check (sample_size >= 1),
  spec_text text not null default '',
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  unique (item_id, revision, characteristic),
  check (kind = 'numeric' or (nominal is null and lower_limit is null and upper_limit is null)),
  check (lower_limit is null or upper_limit is null or lower_limit <= upper_limit),
  foreign key (item_id, company_id) references public.items (id, company_id) on delete cascade
);

alter table public.inspections add column if not exists plan_id uuid references public.inspection_plans (id);
alter table public.inspections add column if not exists outcome text check (outcome in ('pass', 'fail', 'needs_review'));
alter table public.inspections add column if not exists round int not null default 1;
alter table public.inspections add column if not exists lower_limit numeric;
alter table public.inspections add column if not exists upper_limit numeric;
alter table public.inspections add column if not exists resolved_decision text check (resolved_decision in ('pass', 'fail'));
alter table public.inspections add column if not exists resolved_by uuid;
alter table public.inspections add column if not exists resolved_at timestamptz;
alter table public.inspections add column if not exists resolution_reason text;

create function public.inspection_plans_guard() returns trigger language plpgsql set search_path = '' as $$
begin
  if exists (select 1 from public.inspections i where i.plan_id = old.id) and public.is_api_role() then
    raise exception 'this plan characteristic is used by a recorded inspection; add a new one for the next revision instead';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;
create trigger inspection_plans_guard before update or delete on public.inspection_plans for each row execute function public.inspection_plans_guard();
create trigger inspection_plans_stamp before insert on public.inspection_plans for each row execute function public.stamp_created_by();

alter table public.inspection_plans enable row level security;
create policy inspection_plans_read on public.inspection_plans for select using (public.is_member(company_id));
-- The plan sets the limits parts are judged against: only owners and admins write it.
create policy inspection_plans_insert on public.inspection_plans for insert with check (public.is_admin(company_id));
create policy inspection_plans_update on public.inspection_plans for update using (public.is_admin(company_id)) with check (public.is_admin(company_id));
create policy inspection_plans_delete on public.inspection_plans for delete using (public.is_admin(company_id));
grant select, insert, update, delete on public.inspection_plans to authenticated;
create trigger inspection_plans_audit after insert or update or delete on public.inspection_plans for each row execute function public.audit_row();

/**
 * The outcome of one measured value against explicit limits: 'invalid' (not a plain number), 'needs_review' (no usable limit),
 * 'pass' or 'fail'. Same cases as limitOutcome() in src/lib/erp/model.ts (tests/fixtures/limit-cases.json).
 */
create function public.inspection_outcome(observed text, lower_limit numeric, upper_limit numeric) returns text
language plpgsql immutable set search_path = '' as $$
declare
  t text := trim(coalesce(observed, ''));
  v numeric;
begin
  if t !~ '^-?\d+([.,]\d+)?$' then return 'invalid'; end if;
  v := replace(t, ',', '.')::numeric;
  if lower_limit is null and upper_limit is null then return 'needs_review'; end if;
  return case when (lower_limit is null or v >= lower_limit) and (upper_limit is null or v <= upper_limit) then 'pass' else 'fail' end;
end;
$$;

/** The specification as shown on a result: what was typed, or the limits. */
create function public.plan_spec(kind text, nominal numeric, lower_limit numeric, upper_limit numeric, spec_text text) returns text
language sql immutable set search_path = '' as $$
  select case
    when coalesce(spec_text, '') <> '' then spec_text
    when kind <> 'numeric' then ''
    when lower_limit is not null and upper_limit is not null then trim_scale(lower_limit)::text || ' – ' || trim_scale(upper_limit)::text
    when upper_limit is not null then 'max ' || trim_scale(upper_limit)::text
    when lower_limit is not null then 'min ' || trim_scale(lower_limit)::text
    else 'no limits (needs review)'
  end;
$$;

/**
 * Records an inspection of a completed job against its server-stored plan.
 * results: [{plan_id, observed, result: "pass"|"fail", sample_size, gauge_id}] with every plan characteristic exactly once.
 * Any specification, unit or name the client sends is ignored. Returns true when every characteristic passed.
 */
create or replace function public.record_inspection(target_order uuid, results jsonb) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  o public.production_orders%rowtype;
  pl public.inspection_plans%rowtype;
  r jsonb;
  pid uuid;
  seen uuid[] := '{}';
  missing text;
  oc text;
  final text;
  tol text;
  round_no int;
  all_ok boolean := true;
begin
  select * into o from public.production_orders where id = target_order;
  if not found or not public.can_write(o.company_id) then raise exception 'not allowed'; end if;
  if o.status <> 'Completed' then raise exception 'every routing operation must be booked before the inspection is recorded'; end if;
  if not exists (select 1 from public.inspection_plans p where p.item_id = o.item_id and upper(trim(p.revision)) = upper(trim(o.revision))) then
    raise exception 'no inspection plan for this part and revision; an owner or admin adds it first';
  end if;
  if jsonb_typeof(results) is distinct from 'array' then raise exception 'send one result per plan characteristic'; end if;
  for r in select value from jsonb_array_elements(results) loop
    begin
      pid := (r ->> 'plan_id')::uuid;
    exception when others then
      pid := null;
    end;
    if pid is null or not exists (select 1 from public.inspection_plans p where p.id = pid and p.item_id = o.item_id and upper(trim(p.revision)) = upper(trim(o.revision))) then
      raise exception 'a result is not in the inspection plan for this part and revision';
    end if;
    if pid = any (seen) then raise exception '% is recorded more than once', (select p.characteristic from public.inspection_plans p where p.id = pid); end if;
    seen := seen || pid;
  end loop;
  select string_agg(p.characteristic, ', ' order by p.position, p.characteristic) into missing
  from public.inspection_plans p where p.item_id = o.item_id and upper(trim(p.revision)) = upper(trim(o.revision)) and not (p.id = any (seen));
  if missing is not null then raise exception 'results missing: %', missing; end if;
  select coalesce(max(i.round), 0) + 1 into round_no from public.inspections i where i.order_id = o.id;
  for r in select value from jsonb_array_elements(results) loop
    select * into pl from public.inspection_plans p where p.id = (r ->> 'plan_id')::uuid;
    if length(trim(coalesce(r ->> 'observed', ''))) = 0 then raise exception 'enter the measured value for %', pl.characteristic; end if;
    if coalesce(r ->> 'result', '') not in ('pass', 'fail') then raise exception 'choose pass or fail for %', pl.characteristic; end if;
    if coalesce(r ->> 'sample_size', '') !~ '^\d+$' or (r ->> 'sample_size')::int < pl.sample_size then
      raise exception 'measure at least % part(s) for %', pl.sample_size, pl.characteristic;
    end if;
    if pl.required_gauge <> '' and upper(trim(coalesce(r ->> 'gauge_id', ''))) <> upper(trim(pl.required_gauge)) then
      raise exception 'use gauge % for %', pl.required_gauge, pl.characteristic;
    end if;
    if pl.kind = 'numeric' then
      oc := public.inspection_outcome(r ->> 'observed', pl.lower_limit, pl.upper_limit);
      if oc = 'invalid' then raise exception 'enter a number for %', pl.characteristic; end if;
      final := case when oc = 'fail' or r ->> 'result' = 'fail' then 'fail' when oc = 'needs_review' then 'needs_review' else 'pass' end;
      tol := case oc when 'pass' then 'in' when 'fail' then 'out' else 'unknown' end;
    else
      final := r ->> 'result';
      tol := 'unknown';
    end if;
    all_ok := all_ok and final = 'pass';
    insert into public.inspections (company_id, order_id, characteristic, spec, unit, observed, result, tolerance, passed, sample_size, gauge_id, inspected_by,
                                    plan_id, outcome, round, lower_limit, upper_limit)
    values (o.company_id, o.id, pl.characteristic, public.plan_spec(pl.kind, pl.nominal, pl.lower_limit, pl.upper_limit, pl.spec_text), pl.unit,
            trim(r ->> 'observed'), r ->> 'result', tol, final = 'pass', (r ->> 'sample_size')::int, coalesce(trim(r ->> 'gauge_id'), ''), auth.uid(),
            pl.id, final, round_no, pl.lower_limit, pl.upper_limit);
  end loop;
  insert into public.activity_log (company_id, module, action, entity_type, entity_id, summary)
  values (o.company_id, 'quality', 'inspect', 'production_order', o.id, 'Inspection of ' || o.number || ' (round ' || round_no || '): ' || case when all_ok then 'passed' else 'not passed' end);
  return all_ok;
end;
$$;

/** The latest inspection round of an order: 'missing', 'failed', 'needs_review' or 'passed' (resolutions count). */
create function public.inspection_status(target_order uuid) returns text
language sql stable set search_path = '' as $$
  with latest as (
    select coalesce(i.resolved_decision, i.outcome, case when i.passed then 'pass' else 'fail' end) as effective
    from public.inspections i
    where i.order_id = target_order and i.round = (select max(x.round) from public.inspections x where x.order_id = target_order)
  )
  select case
    when not exists (select 1 from latest) then 'missing'
    when exists (select 1 from latest where effective = 'fail') then 'failed'
    when exists (select 1 from latest where effective = 'needs_review') then 'needs_review'
    else 'passed'
  end;
$$;

/** Resolves a "needs review" result. Owner or admin with a reason; not the inspector when the company has another owner or admin. */
create function public.resolve_inspection(inspection_id bigint, decision text, reason text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  i public.inspections%rowtype;
  eligible int;
begin
  select * into i from public.inspections where id = inspection_id for update;
  if not found or not public.is_admin(i.company_id) then raise exception 'only an owner or admin of this company can resolve a review'; end if;
  if decision not in ('pass', 'fail') then raise exception 'decide pass or fail'; end if;
  if length(trim(coalesce(reason, ''))) < 5 then raise exception 'give a reason of at least a few words'; end if;
  if i.outcome is distinct from 'needs_review' or i.resolved_decision is not null then raise exception 'only an unresolved result that needs review can be resolved (it is already resolved or did not need review)'; end if;
  select count(*) into eligible from public.memberships m where m.company_id = i.company_id and m.role in ('owner', 'admin');
  if eligible > 1 and i.inspected_by = auth.uid() then raise exception 'a different owner or admin must resolve this review than the person who inspected it'; end if;
  update public.inspections set resolved_decision = decision, resolved_by = auth.uid(), resolved_at = now(), resolution_reason = trim(reason) where id = inspection_id;
  insert into public.activity_log (company_id, module, action, entity_type, entity_id, summary)
  values (i.company_id, 'quality', 'resolve', 'production_order', i.order_id, i.characteristic || ' resolved as ' || decision || ': ' || trim(reason));
end;
$$;

/* ============================== API access ============================== */

revoke execute on function
  public.approve_file(uuid), public.approve_file(uuid, text), public.supersede_file(uuid, text), public.companies_guard(),
  public.request_company_closure(uuid, text), public.operator_close_access(uuid, text), public.operator_delete_company(uuid, text, boolean, text),
  public.inspection_plans_guard(), public.inspection_outcome(text, numeric, numeric), public.plan_spec(text, numeric, numeric, numeric, text),
  public.inspection_status(uuid), public.resolve_inspection(bigint, text, text), public.delete_company_records(uuid[])
  from public;
do $$
declare
  r text;
begin
  foreach r in array array['anon', 'authenticated'] loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format('revoke execute on function public.approve_file(uuid), public.operator_close_access(uuid, text), public.operator_delete_company(uuid, text, boolean, text), public.delete_company_records(uuid[]) from %I', r);
    end if;
  end loop;
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke execute on function public.approve_file(uuid, text), public.supersede_file(uuid, text), public.companies_guard(), public.request_company_closure(uuid, text), public.inspection_plans_guard(), public.inspection_outcome(text, numeric, numeric), public.plan_spec(text, numeric, numeric, numeric, text), public.inspection_status(uuid), public.resolve_inspection(bigint, text, text) from anon';
  end if;
end;
$$;
grant execute on function
  public.approve_file(uuid, text), public.supersede_file(uuid, text), public.companies_guard(), public.request_company_closure(uuid, text),
  public.inspection_plans_guard(), public.inspection_outcome(text, numeric, numeric), public.plan_spec(text, numeric, numeric, numeric, text),
  public.inspection_status(uuid), public.resolve_inspection(bigint, text, text)
  to authenticated;
