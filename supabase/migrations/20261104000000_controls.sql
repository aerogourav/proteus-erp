-- Phase 3 controls. Additive only: new functions, triggers, one new table, policies and a private Storage bucket.
-- No existing column, row or policy is dropped or rewritten.
--
--  * Approvals happen only through approve_file() (owner or admin). Authors are stamped from the signed-in user.
--  * Invoices and credit notes get their number when issued and are locked from then on. A mistake is corrected
--    with cancel_sales_document(), which issues a credit note; nothing issued is deleted or renumbered.
--  * audit_history is written by triggers only. It has no foreign key to companies, so it outlives deleted rows.
--  * A company with issued documents or history cannot be deleted from the app; that needs the retention process
--    in docs/OPERATIONS.md. Expired demo sandboxes are still purged.
--  * Document numbers use yearly sequences taken from the document date, inside the caller's transaction.
--  * Files in Storage live in the private "company-files" bucket under <company_id>/..., visible only to members.

/* ============================== Helpers ============================== */

/** True when the statement comes straight from the API (PostgREST roles), not from a controlled function. */
create function public.is_api_role() returns boolean
language sql stable set search_path = '' as $$
  select current_user in ('authenticated', 'anon');
$$;

/* ============================== Numbering: yearly, from the document date ============================== */

/**
 * Next number for a company, kind and calendar year of the document date: "INV-2027-0001".
 * The counter row is locked by the update, so concurrent callers queue; a rolled-back transaction gives its number back.
 * The first number of the current year continues an older per-kind counter, so numbers already issued are not repeated.
 */
create function public.document_number(target uuid, kind text, prefix text, doc_date date)
returns text language plpgsql security definer set search_path = '' as $$
declare
  year text := to_char(coalesce(doc_date, current_date), 'YYYY');
  key text := kind || ':' || year;
  value int;
begin
  if not public.can_write(target) then raise exception 'not allowed'; end if;
  insert into public.counters (company_id, kind, next_value)
  values (target, key, coalesce((select c.next_value from public.counters c where c.company_id = target and c.kind = document_number.kind and year = to_char(now(), 'YYYY')), 1))
  on conflict do nothing;
  update public.counters c set next_value = c.next_value + 1
  where c.company_id = target and c.kind = key
  returning c.next_value - 1 into value;
  return prefix || '-' || year || '-' || lpad(value::text, 4, '0');
end;
$$;

-- The original next_number() keeps its signature and now uses the yearly sequence.
create or replace function public.next_number(target uuid, kind text, prefix text) returns text
language plpgsql security definer set search_path = '' as $$
begin
  return public.document_number(target, kind, prefix, current_date);
end;
$$;

create function public.sales_prefix(kind text) returns text language sql immutable set search_path = '' as $$
  select case kind when 'quote' then 'QT' when 'order' then 'SO' when 'invoice' then 'INV' when 'credit_note' then 'CN' else upper(kind) end;
$$;

/* ============================== Authors are stamped, never sent ============================== */

create function public.stamp_created_by() returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then new.created_by := auth.uid(); else new.created_by := old.created_by; end if;
  return new;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array['sales_documents', 'purchase_documents', 'payments', 'stock_moves', 'files'] loop
    execute format('create trigger %I before insert or update on public.%I for each row execute function public.stamp_created_by()', t || '_stamp_created_by', t);
  end loop;
end;
$$;

/* ============================== P12: approvals only through approve_file() ============================== */

create function public.files_guard() returns trigger language plpgsql set search_path = '' as $$
begin
  if not public.is_api_role() then return new; end if;
  if tg_op = 'INSERT' then
    if new.status = 'Approved' or new.approved_by is not null or new.approved_at is not null then
      raise exception 'files are approved only through approve_file()';
    end if;
    return new;
  end if;
  -- A changed file, number or revision is a new version: it goes back to review.
  if old.status = 'Approved' and (new.storage_path, new.number, new.revision) is distinct from (old.storage_path, old.number, old.revision) then
    new.status := 'In review';
  end if;
  if new.status = 'Approved' and (old.status <> 'Approved' or (new.approved_by, new.approved_at) is distinct from (old.approved_by, old.approved_at)) then
    raise exception 'files are approved only through approve_file()';
  end if;
  if new.status <> 'Approved' then
    new.approved_by := null;
    new.approved_at := null;
  end if;
  return new;
end;
$$;
create trigger files_guard before insert or update on public.files for each row execute function public.files_guard();

/** Approves a file (for example a drawing revision). Owner or admin only; the approver is the signed-in user. */
create function public.approve_file(file_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  f public.files%rowtype;
begin
  select * into f from public.files where id = file_id for update;
  if not found or not public.is_admin(f.company_id) then raise exception 'only an owner or admin of this company can approve'; end if;
  if f.status = 'Approved' then return; end if;
  update public.files set status = 'Approved', approved_by = auth.uid(), approved_at = now() where id = file_id;
  insert into public.activity_log (company_id, module, action, entity_type, entity_id, summary)
  values (f.company_id, 'documents', 'approve', 'file', f.id, f.doc_type || ' ' || f.number || ' rev ' || f.revision || ' approved');
end;
$$;

/* ============================== P12: issued invoices are locked ============================== */

create function public.sales_documents_guard() returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if new.kind in ('invoice', 'credit_note') then
      if public.is_api_role() and new.status <> 'Draft' then raise exception 'invoices are issued only through issue_sales_document()'; end if;
      if coalesce(new.number, '') = '' then new.number := 'DRAFT-' || left(new.id::text, 8); end if;
    elsif coalesce(new.number, '') = '' then
      new.number := public.document_number(new.company_id, new.kind, public.sales_prefix(new.kind), new.issue_date);
    end if;
    return new;
  end if;
  if not public.is_api_role() then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  if old.kind in ('invoice', 'credit_note') then
    if tg_op = 'DELETE' then
      if old.status <> 'Draft' then raise exception 'issued % % cannot be deleted; cancel it with a credit note', old.kind, old.number; end if;
      return old;
    end if;
    if old.status = 'Draft' then
      if new.status <> 'Draft' then raise exception 'invoices are issued only through issue_sales_document()'; end if;
      if new.kind <> old.kind then raise exception 'the kind of an invoice cannot change'; end if;
      return new;
    end if;
    -- Issued: only the payment state may change, between Issued and Paid.
    if (to_jsonb(new) - 'status') is distinct from (to_jsonb(old) - 'status') or not (old.status in ('Issued', 'Paid') and new.status in ('Issued', 'Paid')) then
      raise exception 'issued % % is locked', old.kind, old.number;
    end if;
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;
create trigger sales_documents_guard before insert or update or delete on public.sales_documents for each row execute function public.sales_documents_guard();

create function public.sales_lines_guard() returns trigger language plpgsql set search_path = '' as $$
declare
  doc_id uuid := case when tg_op = 'DELETE' then old.document_id else new.document_id end;
begin
  if public.is_api_role() and exists (
    select 1 from public.sales_documents d where d.id in (doc_id, case when tg_op = 'UPDATE' then old.document_id end)
      and d.kind in ('invoice', 'credit_note') and d.status <> 'Draft'
  ) then
    raise exception 'lines of an issued invoice are locked';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;
create trigger sales_lines_guard before insert or update or delete on public.sales_lines for each row execute function public.sales_lines_guard();

/** Issues a draft invoice or credit note: totals from its lines, the next number for its date, then locked. */
create function public.issue_sales_document(doc_id uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare
  d public.sales_documents%rowtype;
  sub numeric(14, 2);
  vat numeric(14, 2);
  num text;
begin
  select * into d from public.sales_documents where id = doc_id for update;
  if not found or not public.can_write(d.company_id) then raise exception 'not allowed'; end if;
  if d.kind not in ('invoice', 'credit_note') or d.status <> 'Draft' then raise exception 'only draft invoices and credit notes can be issued'; end if;
  select round(coalesce(sum(l.quantity * l.unit_price), 0), 2), round(coalesce(sum(l.quantity * l.unit_price * l.tax_rate / 100), 0), 2)
    into sub, vat from public.sales_lines l where l.document_id = doc_id;
  if not exists (select 1 from public.sales_lines l where l.document_id = doc_id) then raise exception 'add at least one line before issuing'; end if;
  num := public.document_number(d.company_id, d.kind, public.sales_prefix(d.kind), d.issue_date);
  update public.sales_documents set number = num, status = 'Issued', subtotal = sub, tax = vat, total = sub + vat where id = doc_id;
  insert into public.activity_log (company_id, module, action, entity_type, entity_id, summary)
  values (d.company_id, 'finance', 'issue', d.kind, d.id, 'Issued ' || num);
  return num;
end;
$$;

/** Cancels an issued invoice with a credit note for the full amount. Owner or admin, with a reason. Returns the credit note number. */
create function public.cancel_sales_document(doc_id uuid, reason text) returns text
language plpgsql security definer set search_path = '' as $$
declare
  d public.sales_documents%rowtype;
  note_id uuid := gen_random_uuid();
  num text;
begin
  select * into d from public.sales_documents where id = doc_id for update;
  if not found or not public.is_admin(d.company_id) then raise exception 'only an owner or admin of this company can cancel an invoice'; end if;
  if d.kind <> 'invoice' or d.status not in ('Issued', 'Paid') then raise exception 'only issued invoices can be cancelled'; end if;
  if length(trim(coalesce(reason, ''))) = 0 then raise exception 'a reason is required'; end if;
  num := public.document_number(d.company_id, 'credit_note', 'CN', current_date);
  insert into public.sales_documents (id, company_id, kind, number, customer_ref, contact_id, project_id, source_id, status, issue_date, currency, subtotal, tax, total, notes)
  values (note_id, d.company_id, 'credit_note', num, d.customer_ref, d.contact_id, d.project_id, d.id, 'Issued', current_date, d.currency, -d.subtotal, -d.tax, -d.total, trim(reason));
  insert into public.sales_lines (company_id, document_id, position, item_id, description, quantity, unit, unit_price, tax_rate)
  select l.company_id, note_id, l.position, l.item_id, l.description, l.quantity, l.unit, -l.unit_price, l.tax_rate from public.sales_lines l where l.document_id = d.id;
  update public.sales_documents set status = 'Cancelled' where id = doc_id;
  insert into public.activity_log (company_id, module, action, entity_type, entity_id, summary)
  values (d.company_id, 'finance', 'cancel', 'invoice', d.id, d.number || ' cancelled with credit note ' || num || ': ' || trim(reason));
  return num;
end;
$$;

-- Purchase documents get a number from the yearly sequence when none is given.
create function public.purchase_documents_number() returns trigger language plpgsql set search_path = '' as $$
begin
  if coalesce(new.number, '') = '' then
    new.number := public.document_number(new.company_id, 'purchase_' || new.kind, case new.kind when 'order' then 'SPO' else 'BILL' end, new.issue_date);
  end if;
  return new;
end;
$$;
create trigger purchase_documents_number before insert on public.purchase_documents for each row execute function public.purchase_documents_number();

/* ============================== P13: audit history written by triggers ============================== */

create table public.audit_history (
  id bigint generated always as identity primary key,
  -- No foreign key on purpose: the history of a deleted row or company is kept.
  company_id uuid not null,
  at timestamptz not null default now(),
  actor uuid,
  table_name text not null,
  row_id text,
  action text not null check (action in ('insert', 'update', 'delete')),
  old_data jsonb,
  new_data jsonb
);
create index audit_history_company_idx on public.audit_history (company_id, at desc);
alter table public.audit_history enable row level security;
-- Members read their company's history; pay changes only admins. Nobody writes or deletes through the API.
create policy audit_history_read on public.audit_history for select
  using (public.is_member(company_id) and (table_name <> 'people_pay' or public.is_admin(company_id)));

create function public.audit_row() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  rec jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
begin
  insert into public.audit_history (company_id, actor, table_name, row_id, action, old_data, new_data)
  values (
    coalesce(rec ->> 'company_id', rec ->> 'id')::uuid, auth.uid(), tg_table_name, coalesce(rec ->> 'id', rec ->> 'person_id', rec ->> 'user_id'),
    lower(tg_op), case when tg_op <> 'INSERT' then to_jsonb(old) end, case when tg_op <> 'DELETE' then to_jsonb(new) end
  );
  return null;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array['companies', 'memberships', 'people', 'people_pay', 'contacts', 'items', 'warehouses', 'projects',
                           'sales_documents', 'sales_lines', 'purchase_documents', 'purchase_lines', 'payments', 'files'] loop
    execute format('create trigger %I after insert or update or delete on public.%I for each row execute function public.audit_row()', t || '_audit', t);
  end loop;
end;
$$;

/* ============================== P13: companies with records are kept ============================== */

create function public.companies_keep_records() returns trigger language plpgsql set search_path = '' as $$
begin
  if old.is_demo or not public.is_api_role() then return old; end if;
  if exists (select 1 from public.sales_documents d where d.company_id = old.id and d.kind in ('invoice', 'credit_note') and d.status <> 'Draft')
     or exists (select 1 from public.activity_log a where a.company_id = old.id)
     or exists (select 1 from public.audit_history h where h.company_id = old.id and h.table_name <> 'companies' and h.table_name <> 'memberships') then
    raise exception 'this company has issued documents or history; it is closed through the retention process, not deleted';
  end if;
  return old;
end;
$$;
create trigger companies_keep_records before delete on public.companies for each row execute function public.companies_keep_records();

/* ============================== Storage: one private folder per company ============================== */

/** The company a Storage path belongs to: its first folder ("<company_id>/drawings/x.pdf"). Null when it is not a company folder. */
create function public.folder_company(path text) returns uuid
language plpgsql immutable set search_path = '' as $$
begin
  return split_part(path, '/', 1)::uuid;
exception when others then
  return null;
end;
$$;

do $$
begin
  if to_regclass('storage.objects') is null then
    return; -- No Storage in this database (for example a local test database).
  end if;
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets (id, name, public) values ('company-files', 'company-files', false) on conflict (id) do nothing;
  end if;
  execute $p$create policy boh_company_files_read on storage.objects for select to authenticated
    using (bucket_id = 'company-files' and public.is_member(public.folder_company(name)))$p$;
  execute $p$create policy boh_company_files_insert on storage.objects for insert to authenticated
    with check (bucket_id = 'company-files' and public.can_write(public.folder_company(name)))$p$;
  execute $p$create policy boh_company_files_update on storage.objects for update to authenticated
    using (bucket_id = 'company-files' and public.can_write(public.folder_company(name)))
    with check (bucket_id = 'company-files' and public.can_write(public.folder_company(name)))$p$;
  execute $p$create policy boh_company_files_delete on storage.objects for delete to authenticated
    using (bucket_id = 'company-files' and public.is_admin(public.folder_company(name)))$p$;
end;
$$;

/* ============================== API access ============================== */

grant select on public.audit_history to authenticated;

revoke execute on function
  public.is_api_role(), public.document_number(uuid, text, text, date), public.sales_prefix(text), public.stamp_created_by(), public.files_guard(),
  public.approve_file(uuid), public.sales_documents_guard(), public.sales_lines_guard(), public.issue_sales_document(uuid),
  public.cancel_sales_document(uuid, text), public.purchase_documents_number(), public.audit_row(), public.companies_keep_records(), public.folder_company(text)
  from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke execute on function public.is_api_role(), public.document_number(uuid, text, text, date), public.sales_prefix(text), public.stamp_created_by(), public.files_guard(), public.approve_file(uuid), public.sales_documents_guard(), public.sales_lines_guard(), public.issue_sales_document(uuid), public.cancel_sales_document(uuid, text), public.purchase_documents_number(), public.audit_row(), public.companies_keep_records(), public.folder_company(text) from anon';
  end if;
end;
$$;
grant execute on function
  public.is_api_role(), public.document_number(uuid, text, text, date), public.sales_prefix(text), public.stamp_created_by(), public.files_guard(),
  public.approve_file(uuid), public.sales_documents_guard(), public.sales_lines_guard(), public.issue_sales_document(uuid),
  public.cancel_sales_document(uuid, text), public.purchase_documents_number(), public.companies_keep_records(), public.folder_company(text)
  to authenticated;
