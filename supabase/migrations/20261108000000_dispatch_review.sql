-- Hardening phase 3: dispatch in the database, plus gaps found in the table and function review (docs/DB-REVIEW.md).
-- Adds to the earlier migrations; none of them is edited.
--
--  P11  dispatch_order() ships the good parts of a completed job only when its latest inspection passed and its drawing is
--       still approved with no newer revision. Drawing problems found at dispatch can be released by an owner or admin with a
--       reason (release_dispatch(), logged). Delivery notes get their number from the yearly sequence. No direct writes.
--  P12  Recorded payments are not edited or deleted from the app (a mistake is corrected with a counter-entry); the new
--       dispatch release field is protected like the other release fields.

alter table public.production_orders add column if not exists dispatch_release jsonb;

create or replace function public.production_orders_guard() returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if public.is_api_role() and (new.status <> 'Planned' or new.routing is not null or new.material_issued_at is not null or new.release_override is not null
       or new.completed_at is not null or new.cost_snapshot is not null or new.dispatch_release is not null) then
      raise exception 'new production orders start as Planned; status changes go through the production functions';
    end if;
    new.created_by := auth.uid();
    return new;
  end if;
  if not public.is_api_role() then return case when tg_op = 'DELETE' then old else new end; end if;
  if tg_op = 'DELETE' then
    if old.status <> 'Planned' or exists (select 1 from public.operation_logs l where l.order_id = old.id) then
      raise exception '% has work booked and is kept', old.number;
    end if;
    return old;
  end if;
  if (new.company_id, new.number, new.item_id, new.revision, new.status, new.routing, new.material_issued_at, new.release_override, new.completed_at, new.cost_snapshot, new.dispatch_release, new.created_by, new.created_at)
     is distinct from (old.company_id, old.number, old.item_id, old.revision, old.status, old.routing, old.material_issued_at, old.release_override, old.completed_at, old.cost_snapshot, old.dispatch_release, old.created_by, old.created_at) then
    raise exception 'status, revision and release fields change only through the production functions';
  end if;
  if new.quantity <> old.quantity and (old.status <> 'Planned' or exists (select 1 from public.operation_logs l where l.order_id = old.id)) then
    raise exception 'the quantity cannot change once work has started';
  end if;
  return new;
end;
$$;

create table public.dispatches (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  order_id uuid not null,
  number text not null,
  quantity int not null check (quantity > 0),
  note text not null default '',
  dispatched_by uuid default auth.uid(),
  dispatched_at timestamptz not null default now(),
  unique (company_id, number),
  foreign key (order_id, company_id) references public.production_orders (id, company_id)
);
alter table public.dispatches enable row level security;
create policy dispatches_read on public.dispatches for select using (public.is_member(company_id));
grant select on public.dispatches to authenticated;
create trigger dispatches_audit after insert or update or delete on public.dispatches for each row execute function public.audit_row();

/** Good parts at the last operation of an order, minus what was already dispatched. */
create function public.dispatchable_quantity(target_order uuid) returns int
language sql stable set search_path = '' as $$
  select greatest(0,
    coalesce((select x.good from public.order_progress(target_order) x order by x.seq desc limit 1), 0)
    - coalesce((select sum(d.quantity) from public.dispatches d where d.order_id = target_order), 0))::int;
$$;

/** Drawing problems found at dispatch (not approved for the ordered revision, or a newer revision exists). */
create function public.dispatch_drawing_blockers(target_order uuid) returns text[]
language sql stable set search_path = '' as $$
  select coalesce(array_agg(b), '{}') from unnest(public.release_blockers(target_order)) b where b like 'No drawing%' or b like 'Drawing %';
$$;

/** Everything that stops a dispatch, after the owner's or admin's dispatch release. Empty when the job may ship. */
create function public.dispatch_blockers(target_order uuid) returns text[]
language plpgsql stable set search_path = '' as $$
declare
  o public.production_orders%rowtype;
  blockers text[] := '{}';
  status text;
  b text;
begin
  select * into o from public.production_orders where id = target_order;
  if not found then return array['Production order not found.']; end if;
  if o.status <> 'Completed' then blockers := blockers || format('%s is not completed: every operation must be booked first.', o.number); end if;
  status := public.inspection_status(target_order);
  if status = 'missing' then blockers := blockers || 'The final inspection has not been recorded.'::text;
  elsif status = 'failed' then blockers := blockers || 'The latest inspection failed. Inspect again after rework.'::text;
  elsif status = 'needs_review' then blockers := blockers || 'A result of the latest inspection needs review by an owner or admin.'::text;
  end if;
  foreach b in array public.dispatch_drawing_blockers(target_order) loop
    if not coalesce((o.dispatch_release -> 'blockers') ? b, false) then blockers := blockers || b; end if;
  end loop;
  if o.status = 'Completed' and public.dispatchable_quantity(target_order) = 0 then blockers := blockers || 'Everything produced has already been dispatched.'::text; end if;
  return blockers;
end;
$$;

/** Allows dispatch despite the drawing problems found now. Owner or admin with a reason; logged. Inspection results are never released here. */
create function public.release_dispatch(target_order uuid, reason text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  o public.production_orders%rowtype;
  found_now text[];
begin
  select * into o from public.production_orders where id = target_order for update;
  if not found or not public.is_admin(o.company_id) then raise exception 'only an owner or admin of this company can release a dispatch'; end if;
  if length(trim(coalesce(reason, ''))) < 5 then raise exception 'give a reason of at least a few words'; end if;
  found_now := public.dispatch_drawing_blockers(target_order);
  if cardinality(found_now) = 0 then raise exception 'there is no drawing problem to release'; end if;
  update public.production_orders set dispatch_release = jsonb_build_object('by', auth.uid(), 'reason', trim(reason), 'at', now(),
    'blockers', coalesce(dispatch_release -> 'blockers', '[]'::jsonb) || to_jsonb(found_now)) where id = target_order;
  insert into public.activity_log (company_id, module, action, entity_type, entity_id, summary, data)
  values (o.company_id, 'dispatch', 'release', 'production_order', o.id, 'Dispatch of ' || o.number || ' released: ' || trim(reason), jsonb_build_object('blockers', to_jsonb(found_now)));
end;
$$;

/** Dispatches the remaining good parts of a completed job with a delivery note. Returns the delivery note number. */
create function public.dispatch_order(target_order uuid, note text default '') returns text
language plpgsql security definer set search_path = '' as $$
declare
  o public.production_orders%rowtype;
  blockers text[];
  qty int;
  num text;
begin
  select * into o from public.production_orders where id = target_order for update;
  if not found or not public.can_write(o.company_id) then raise exception 'not allowed'; end if;
  blockers := public.dispatch_blockers(target_order);
  if cardinality(blockers) > 0 then raise exception '%', blockers[1]; end if;
  qty := public.dispatchable_quantity(target_order);
  num := public.document_number(o.company_id, 'delivery_note', 'DN', current_date);
  insert into public.dispatches (company_id, order_id, number, quantity, note) values (o.company_id, o.id, num, qty, left(trim(coalesce(note, '')), 300));
  insert into public.activity_log (company_id, module, action, entity_type, entity_id, summary)
  values (o.company_id, 'dispatch', 'dispatch', 'production_order', o.id, o.number || ': ' || qty || ' parts dispatched with ' || num);
  return num;
end;
$$;

/* ============================== Review gaps ============================== */

create function public.payments_guard() returns trigger language plpgsql set search_path = '' as $$
begin
  if public.is_api_role() then raise exception 'payments are not edited or deleted; record a correcting payment in the other direction instead'; end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;
create trigger payments_guard before update or delete on public.payments for each row execute function public.payments_guard();

/* ============================== API access ============================== */

revoke execute on function
  public.dispatchable_quantity(uuid), public.dispatch_drawing_blockers(uuid), public.dispatch_blockers(uuid), public.release_dispatch(uuid, text),
  public.dispatch_order(uuid, text), public.payments_guard()
  from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke execute on function public.dispatchable_quantity(uuid), public.dispatch_drawing_blockers(uuid), public.dispatch_blockers(uuid), public.release_dispatch(uuid, text), public.dispatch_order(uuid, text), public.payments_guard() from anon';
  end if;
end;
$$;
grant execute on function
  public.dispatchable_quantity(uuid), public.dispatch_drawing_blockers(uuid), public.dispatch_blockers(uuid), public.release_dispatch(uuid, text),
  public.dispatch_order(uuid, text), public.payments_guard()
  to authenticated;
