-- Hardening phase 2: finance, material and traceability. Adds to the earlier migrations; none of them is edited.
--
--  N8   Credit notes come only from cancelling an invoice (owner or admin). A document's kind never changes. Nobody calls
--       the numbering functions directly: numbers are assigned by database triggers and the issue function. Issue dates:
--       not in the future, not before the last issued document of the same kind and year (so numbers follow dates),
--       more than 3 days back only by an owner or admin with a reason, and never in a closed period (close_books()).
--  N10  Members book real goods receipts only. Adjustments go through adjust_stock() (owner or admin, reason).
--       After release, required material changes only through change_order_material() (owner or admin, reason);
--       the difference is booked in stock. Stock moves are now in the audit history.
--  N11  Lots (heat/batch, certificate) recorded at goods receipt follow the material to the job when it is issued.
--       A closed job's lots are locked; correct_material_lot() (owner or admin, reason) changes them, the audit keeps the old value.
--  P9   A closed job freezes labour, overhead, material, exchange rates and currency.
--  N14  Bookings are made by the signed-in person linked to the operator, or with that operator's PIN on a shared terminal.
--       Wrong PINs are counted (5 lock the PIN for 15 minutes). Only owners and admins link people to sign-ins and set PINs.
--       The activity log is written only by the database (functions and triggers); clients cannot insert into it.

/* ============================== N8: numbering by trigger only ============================== */

-- Runs as the function owner so the numbering function can stay private; it only fills an empty number.
create function public.assign_document_number() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(new.number, '') <> '' then return new; end if;
  if tg_table_name = 'sales_documents' then
    if new.kind not in ('invoice', 'credit_note') then
      new.number := public.document_number(new.company_id, new.kind, public.sales_prefix(new.kind), new.issue_date);
    end if;
  elsif tg_table_name = 'production_orders' then
    new.number := public.document_number(new.company_id, 'production_order', 'MO', coalesce(new.created_at, now())::date);
  end if;
  return new;
end;
$$;
create trigger sales_documents_number before insert on public.sales_documents for each row execute function public.assign_document_number();
create trigger production_orders_number before insert on public.production_orders for each row execute function public.assign_document_number();

-- Purchase numbering keeps its trigger, now running as the function owner.
create or replace function public.purchase_documents_number() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(new.number, '') = '' then
    new.number := public.document_number(new.company_id, 'purchase_' || new.kind, case new.kind when 'order' then 'SPO' else 'BILL' end, new.issue_date);
  end if;
  return new;
end;
$$;

create or replace function public.sales_documents_guard() returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if public.is_api_role() and new.kind = 'credit_note' then raise exception 'credit notes are issued only by cancelling an invoice (owner or admin)'; end if;
    if new.kind in ('invoice', 'credit_note') then
      if public.is_api_role() and new.status <> 'Draft' then raise exception 'invoices are issued only through issue_sales_document()'; end if;
      if coalesce(new.number, '') = '' then new.number := 'DRAFT-' || left(new.id::text, 8); end if;
    end if;
    return new;
  end if;
  if not public.is_api_role() then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  if tg_op = 'UPDATE' and new.kind is distinct from old.kind then raise exception 'the kind of a document never changes; create a new document instead'; end if;
  if old.kind in ('invoice', 'credit_note') then
    if tg_op = 'DELETE' then
      if old.status <> 'Draft' then raise exception 'issued % % cannot be deleted; cancel it with a credit note', old.kind, old.number; end if;
      return old;
    end if;
    if old.status = 'Draft' then
      if new.status <> 'Draft' then raise exception 'invoices are issued only through issue_sales_document()'; end if;
      return new;
    end if;
    if (to_jsonb(new) - 'status') is distinct from (to_jsonb(old) - 'status') or not (old.status in ('Issued', 'Paid') and new.status in ('Issued', 'Paid')) then
      raise exception 'issued % % is locked', old.kind, old.number;
    end if;
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create or replace function public.production_orders_guard() returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if public.is_api_role() and (new.status <> 'Planned' or new.routing is not null or new.material_issued_at is not null or new.release_override is not null or new.completed_at is not null or new.cost_snapshot is not null) then
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
  if (new.company_id, new.number, new.item_id, new.revision, new.status, new.routing, new.material_issued_at, new.release_override, new.completed_at, new.cost_snapshot, new.created_by, new.created_at)
     is distinct from (old.company_id, old.number, old.item_id, old.revision, old.status, old.routing, old.material_issued_at, old.release_override, old.completed_at, old.cost_snapshot, old.created_by, old.created_at) then
    raise exception 'status, revision and release fields change only through the production functions';
  end if;
  if new.quantity <> old.quantity and (old.status <> 'Planned' or exists (select 1 from public.operation_logs l where l.order_id = old.id)) then
    raise exception 'the quantity cannot change once work has started';
  end if;
  return new;
end;
$$;

/* ============================== N8: issue dates and closed periods ============================== */

alter table public.companies add column if not exists books_closed_until date;

create or replace function public.companies_guard() returns trigger language plpgsql set search_path = '' as $$
begin
  if public.is_api_role() and (new.is_demo, new.expires_at) is distinct from (old.is_demo, old.expires_at) then
    raise exception 'the demo flag and expiry are set by the server only';
  end if;
  if public.is_api_role() and new.books_closed_until is distinct from old.books_closed_until then
    raise exception 'closed periods are set by the server only, through close_books()';
  end if;
  return new;
end;
$$;

/** Closes the books up to a date (owner or admin, reason). A closed period is never reopened. */
create function public.close_books(target uuid, until date, reason text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  c public.companies%rowtype;
begin
  select * into c from public.companies where id = target for update;
  if not found or not public.is_admin(target) then raise exception 'only an owner or admin of this company can close the books'; end if;
  if length(trim(coalesce(reason, ''))) < 5 then raise exception 'give a reason of at least a few words'; end if;
  if until > current_date then raise exception 'the books cannot be closed for a future date'; end if;
  if c.books_closed_until is not null and until < c.books_closed_until then raise exception 'a closed period is never reopened'; end if;
  update public.companies set books_closed_until = until where id = target;
  insert into public.activity_log (company_id, module, action, entity_type, entity_id, summary)
  values (target, 'finance', 'close_books', 'company', target, 'Books closed up to ' || until || ': ' || trim(reason));
end;
$$;

/** Issues a draft invoice or credit note with the date rules. Internal; the public overloads call it. */
create function public.issue_document_internal(doc_id uuid, backdate_reason text) returns text
language plpgsql security definer set search_path = '' as $$
declare
  d public.sales_documents%rowtype;
  c public.companies%rowtype;
  sub numeric(14, 2);
  vat numeric(14, 2);
  num text;
begin
  select * into d from public.sales_documents where id = doc_id for update;
  if not found or not public.can_write(d.company_id) then raise exception 'not allowed'; end if;
  if d.kind not in ('invoice', 'credit_note') or d.status <> 'Draft' then raise exception 'only draft invoices and credit notes can be issued'; end if;
  select * into c from public.companies where id = d.company_id;
  if d.issue_date > current_date then raise exception 'an invoice cannot be dated in the future'; end if;
  if c.books_closed_until is not null and d.issue_date <= c.books_closed_until then
    raise exception 'the books are closed up to %; this date is in a closed period', c.books_closed_until;
  end if;
  if exists (select 1 from public.sales_documents x where x.company_id = d.company_id and x.kind = d.kind and x.status <> 'Draft' and x.id <> d.id
             and extract(year from x.issue_date) = extract(year from d.issue_date) and x.issue_date > d.issue_date) then
    raise exception 'the issue date must not be earlier than the last issued % of that year, so numbers follow dates', replace(d.kind, '_', ' ');
  end if;
  if d.issue_date < current_date - 3 and (not public.is_admin(d.company_id) or length(trim(coalesce(backdate_reason, ''))) < 5) then
    raise exception 'dating an invoice more than 3 days back needs an owner or admin and a reason';
  end if;
  if not exists (select 1 from public.sales_lines l where l.document_id = doc_id) then raise exception 'add at least one line before issuing'; end if;
  select round(coalesce(sum(l.quantity * l.unit_price), 0), 2), round(coalesce(sum(l.quantity * l.unit_price * l.tax_rate / 100), 0), 2)
    into sub, vat from public.sales_lines l where l.document_id = doc_id;
  num := public.document_number(d.company_id, d.kind, public.sales_prefix(d.kind), d.issue_date);
  update public.sales_documents set number = num, status = 'Issued', subtotal = sub, tax = vat, total = sub + vat where id = doc_id;
  insert into public.activity_log (company_id, module, action, entity_type, entity_id, summary)
  values (d.company_id, 'finance', 'issue', d.kind, d.id, 'Issued ' || num || ' dated ' || d.issue_date
    || case when d.issue_date < current_date - 3 then ' (backdated: ' || trim(backdate_reason) || ')' else '' end);
  return num;
end;
$$;

create or replace function public.issue_sales_document(doc_id uuid) returns text
language plpgsql security definer set search_path = '' as $$
begin
  return public.issue_document_internal(doc_id, null);
end;
$$;

/** Issues a draft dated more than 3 days back: owner or admin, with the reason recorded. */
create function public.issue_sales_document(doc_id uuid, backdate_reason text) returns text
language plpgsql security definer set search_path = '' as $$
begin
  return public.issue_document_internal(doc_id, backdate_reason);
end;
$$;

/* ============================== N10: stock and released material ============================== */

alter table public.stock_moves add column if not exists lot text not null default '';
alter table public.stock_moves add column if not exists certificate text not null default '';

create function public.stock_moves_guard() returns trigger language plpgsql set search_path = '' as $$
begin
  if public.is_api_role() and (new.reason <> 'receipt' or new.quantity <= 0) then
    raise exception 'only goods receipts are booked directly; adjustments go through adjust_stock() by an owner or admin';
  end if;
  return new;
end;
$$;
create trigger stock_moves_guard before insert on public.stock_moves for each row execute function public.stock_moves_guard();
create trigger stock_moves_audit after insert or update or delete on public.stock_moves for each row execute function public.audit_row();

/** Books a stock correction (count difference, damage, loss). Owner or admin with a reason; logged and audited. */
create function public.adjust_stock(target_item uuid, target_warehouse uuid, amount numeric, reason text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  i public.items%rowtype;
begin
  select * into i from public.items where id = target_item;
  if not found or not public.is_admin(i.company_id) then raise exception 'only an owner or admin of this company can adjust stock'; end if;
  if length(trim(coalesce(reason, ''))) < 5 then raise exception 'give a reason of at least a few words'; end if;
  if amount is null or amount = 0 then raise exception 'enter the quantity to add or remove'; end if;
  insert into public.stock_moves (company_id, item_id, warehouse_id, quantity, reason, note) values (i.company_id, target_item, target_warehouse, amount, 'adjustment', trim(reason));
  insert into public.activity_log (company_id, module, action, entity_type, entity_id, summary)
  values (i.company_id, 'materials', 'adjust', 'item', i.id, i.sku || ': stock ' || case when amount > 0 then '+' else '' end || trim_scale(amount) || ' ' || i.unit || ' (' || trim(reason) || ')');
end;
$$;

create or replace function public.order_materials_guard() returns trigger language plpgsql set search_path = '' as $$
declare
  target uuid := case when tg_op = 'DELETE' then old.order_id else new.order_id end;
begin
  if public.is_api_role() and exists (select 1 from public.production_orders p where p.id = target and (p.material_issued_at is not null or p.status <> 'Planned')) then
    raise exception 'material requirements are fixed once the order is released; an owner or admin changes them with change_order_material() and a reason';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

/** Changes a released material requirement (owner or admin, reason). If the material was issued, the difference is booked in stock. */
create function public.change_order_material(order_material_id uuid, new_quantity numeric, reason text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  m public.order_materials%rowtype;
  o public.production_orders%rowtype;
  i public.items%rowtype;
  diff numeric;
begin
  select * into m from public.order_materials where id = order_material_id for update;
  if not found or not public.is_admin(m.company_id) then raise exception 'only an owner or admin of this company can change released material'; end if;
  if length(trim(coalesce(reason, ''))) < 5 then raise exception 'give a reason of at least a few words'; end if;
  if new_quantity is null or new_quantity <= 0 then raise exception 'the quantity must be above 0'; end if;
  select * into o from public.production_orders where id = m.order_id;
  select * into i from public.items where id = m.item_id;
  diff := new_quantity - m.quantity;
  if diff = 0 then return; end if;
  update public.order_materials set quantity = new_quantity where id = order_material_id;
  if o.material_issued_at is not null then
    insert into public.stock_moves (company_id, item_id, warehouse_id, quantity, reason, ref_type, ref_id, note)
    values (m.company_id, m.item_id, m.warehouse_id, -diff, case when diff > 0 then 'issue' else 'return' end, 'production_order', o.id, 'Material change for ' || o.number || ': ' || trim(reason));
  end if;
  insert into public.activity_log (company_id, module, action, entity_type, entity_id, summary)
  values (m.company_id, 'materials', 'change', 'production_order', o.id, o.number || ': ' || i.sku || ' ' || trim_scale(m.quantity) || ' → ' || trim_scale(new_quantity) || ' ' || i.unit || ' (' || trim(reason) || ')');
end;
$$;

/* ============================== N11: lots locked at close ============================== */

create function public.material_lots_guard() returns trigger language plpgsql set search_path = '' as $$
declare
  target uuid := case when tg_op = 'DELETE' then old.order_id else new.order_id end;
begin
  if public.is_api_role() and exists (select 1 from public.production_orders p where p.id = target and p.status = 'Completed') then
    raise exception 'lots of a closed job are locked; an owner or admin corrects them with correct_material_lot() and a reason';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;
create trigger material_lots_guard before insert or update or delete on public.material_lots for each row execute function public.material_lots_guard();

/** Corrects a lot of a job (also after close). Owner or admin with a reason; the audit history keeps the old value. */
create function public.correct_material_lot(target_order uuid, material_name text, heat_no text, certificate_no text, reason text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  o public.production_orders%rowtype;
  old_heat text;
begin
  select * into o from public.production_orders where id = target_order;
  if not found or not public.is_admin(o.company_id) then raise exception 'only an owner or admin of this company can correct a lot'; end if;
  if length(trim(coalesce(reason, ''))) < 5 then raise exception 'give a reason of at least a few words'; end if;
  if length(trim(coalesce(material_name, ''))) = 0 or length(trim(coalesce(heat_no, ''))) = 0 then raise exception 'enter the material and its heat number or batch'; end if;
  select l.heat into old_heat from public.material_lots l where l.order_id = target_order and l.material = trim(material_name);
  insert into public.material_lots (company_id, order_id, material, heat, certificate)
  values (o.company_id, o.id, trim(material_name), trim(heat_no), trim(coalesce(certificate_no, '')))
  on conflict (order_id, material) do update set heat = excluded.heat, certificate = excluded.certificate;
  insert into public.activity_log (company_id, module, action, entity_type, entity_id, summary)
  values (o.company_id, 'materials', 'correct_lot', 'production_order', o.id, o.number || ': ' || trim(material_name) || ' heat/batch ' || coalesce(old_heat, '—') || ' → ' || trim(heat_no) || ' (' || trim(reason) || ')');
end;
$$;

/* ============================== N14: operator identity ============================== */

-- PIN hashes are never readable through the API: no policies and no grants.
create table public.people_pins (
  person_id uuid primary key references public.people (id) on delete cascade,
  company_id uuid not null,
  salt text not null,
  pin_hash text not null,
  failed_attempts int not null default 0,
  locked_until timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.people_pins enable row level security;

create function public.people_guard() returns trigger language plpgsql set search_path = '' as $$
begin
  if public.is_api_role() and not public.is_admin(new.company_id)
     and ((tg_op = 'INSERT' and new.user_id is not null) or (tg_op = 'UPDATE' and new.user_id is distinct from old.user_id)) then
    raise exception 'only an owner or admin links a person to a sign-in';
  end if;
  return new;
end;
$$;
create trigger people_guard before insert or update on public.people for each row execute function public.people_guard();

/** Sets or replaces an operator's shop-floor PIN (4 to 8 digits). Owner or admin. The PIN itself is never stored or logged. */
create function public.set_person_pin(person uuid, pin text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  p public.people%rowtype;
  salt text := md5(random()::text || clock_timestamp()::text || person::text);
begin
  select * into p from public.people where id = person;
  if not found or not public.is_admin(p.company_id) then raise exception 'only an owner or admin of this company can set a PIN'; end if;
  if coalesce(pin, '') !~ '^\d{4,8}$' then raise exception 'a PIN has 4 to 8 digits'; end if;
  insert into public.people_pins (person_id, company_id, salt, pin_hash) values (person, p.company_id, salt, encode(sha256(convert_to(salt || pin, 'UTF8')), 'hex'))
  on conflict (person_id) do update set salt = excluded.salt, pin_hash = excluded.pin_hash, failed_attempts = 0, locked_until = null, updated_at = now();
  insert into public.activity_log (company_id, module, action, entity_type, entity_id, summary)
  values (p.company_id, 'people', 'pin', 'person', p.id, 'Shop-floor PIN set for ' || p.code);
end;
$$;

/** Checks an operator PIN. Wrong PINs are counted; 5 in a row lock the PIN for 15 minutes. Internal. */
create function public.pin_ok(person uuid, pin text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  r public.people_pins%rowtype;
begin
  select * into r from public.people_pins where person_id = person for update;
  if not found then return false; end if;
  if r.locked_until is not null and r.locked_until > now() then return false; end if;
  if encode(sha256(convert_to(r.salt || coalesce(pin, ''), 'UTF8')), 'hex') = r.pin_hash then
    update public.people_pins set failed_attempts = 0, locked_until = null where person_id = person;
    return true;
  end if;
  update public.people_pins set failed_attempts = r.failed_attempts + 1,
    locked_until = case when r.failed_attempts + 1 >= 5 then now() + interval '15 minutes' else null end
  where person_id = person;
  return false;
end;
$$;

/** The start rules (release gate, quantities, one operation per person, material issue). Internal: called after identity is confirmed. */
create function public.start_operation_as(target_order uuid, person uuid, op_seq int) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  o public.production_orders%rowtype;
  p public.people%rowtype;
  chosen record;
  gate text;
  act uuid;
  m record;
begin
  select * into o from public.production_orders where id = target_order for update;
  if not found or not public.can_write(o.company_id) then raise exception 'not allowed'; end if;
  if o.status = 'Completed' then raise exception '% is already completed.', o.number; end if;
  if o.status = 'On hold' then raise exception '% is on hold.', o.number; end if;
  select * into p from public.people where id = person and company_id = o.company_id;
  if not found then raise exception 'Choose who you are first.'; end if;
  if not p.active then raise exception '% is marked inactive.', p.name; end if;
  if exists (select 1 from public.active_operations a where a.person_id = person) then raise exception '% is still running an operation. End it first.', p.name; end if;
  gate := public.release_gate(target_order);
  if gate is not null then raise exception '%', gate; end if;
  select * into chosen from public.order_progress(target_order) x
  where (op_seq is null and not x.done and x.remaining > 0) or x.seq = op_seq order by x.seq limit 1;
  if not found then raise exception 'No parts are waiting for an operation.'; end if;
  if chosen.remaining <= 0 then raise exception 'No parts are waiting at Op % %.', chosen.seq, chosen.name; end if;
  update public.production_orders set routing = coalesce(routing, public.item_routing(item_id)), status = 'Running' where id = target_order;
  insert into public.active_operations (company_id, order_id, seq, person_id) values (o.company_id, o.id, chosen.seq, person) returning id into act;
  if o.material_issued_at is null then
    for m in select om.item_id, om.warehouse_id, om.quantity from public.order_materials om where om.order_id = o.id loop
      insert into public.stock_moves (company_id, item_id, warehouse_id, quantity, reason, ref_type, ref_id, note)
      values (o.company_id, m.item_id, m.warehouse_id, -m.quantity, 'issue', 'production_order', o.id, 'Issued to ' || o.number);
    end loop;
    -- The lot of the latest receipt of each material follows it to the job.
    insert into public.material_lots (company_id, order_id, material, heat, certificate)
    select o.company_id, o.id, i.sku, r.lot, r.certificate
    from public.order_materials om
    join public.items i on i.id = om.item_id
    cross join lateral (
      select sm.lot, sm.certificate from public.stock_moves sm
      where sm.item_id = om.item_id and sm.warehouse_id = om.warehouse_id and sm.reason = 'receipt' and sm.lot <> ''
      order by sm.created_at desc, sm.id desc limit 1
    ) r
    where om.order_id = o.id
    on conflict (order_id, material) do nothing;
    update public.production_orders set material_issued_at = now() where id = target_order;
  end if;
  insert into public.activity_log (company_id, module, action, entity_type, entity_id, summary)
  values (o.company_id, 'shopfloor', 'start', 'production_order', o.id, o.number || ' · Op ' || chosen.seq || ' ' || chosen.name || ' started by ' || p.name || ' (' || p.code || ')');
  return act;
end;
$$;

/** The booking rules (quantities, completion, frozen costs). Internal: called after identity is confirmed. */
create function public.end_operation_as(active uuid, good int, scrap int, notes text) returns text
language plpgsql security definer set search_path = '' as $$
declare
  a public.active_operations%rowtype;
  o public.production_orders%rowtype;
  op record;
  p public.people%rowtype;
  mins numeric;
begin
  select * into a from public.active_operations where id = active for update;
  if not found then raise exception 'This operation is not running any more.'; end if;
  select * into o from public.production_orders where id = a.order_id for update;
  if not public.can_write(o.company_id) then raise exception 'not allowed'; end if;
  if good is null or scrap is null or good < 0 or scrap < 0 then raise exception 'Enter whole numbers of 0 or more.'; end if;
  if good + scrap = 0 then raise exception 'Enter the good and scrap quantity.'; end if;
  select * into op from public.order_progress(o.id) x where x.seq = a.seq;
  if good + scrap > op.remaining then
    raise exception 'Only % parts can be booked at Op %: % arrived and % are already booked.', op.remaining, op.seq, op.incoming, op.booked;
  end if;
  select * into p from public.people where id = a.person_id;
  mins := greatest(0.1, round((extract(epoch from (now() - a.started_at)) / 60)::numeric, 1));
  insert into public.operation_logs (company_id, order_id, seq, operation, work_center, person_id, started_at, ended_at, minutes, planned_minutes, qty_good, qty_scrap, notes)
  values (o.company_id, o.id, a.seq, op.name, op.work_center, a.person_id, a.started_at, now(), mins, round(op.setup_min + op.run_min_per_pc * (good + scrap), 1), good, scrap, left(trim(coalesce(notes, '')), 300));
  delete from public.active_operations where id = active;
  insert into public.activity_log (company_id, module, action, entity_type, entity_id, summary)
  values (o.company_id, 'shopfloor', 'end', 'production_order', o.id, o.number || ' · Op ' || a.seq || ' ' || op.name || ' ended by ' || p.name || ': ' || good || ' good, ' || scrap || ' scrap');
  if public.completion_blocker(o.id) is null then perform public.complete_order(o.id); return 'Completed'; end if;
  return 'Running';
end;
$$;

/** Starts an operation as the signed-in person (their sign-in must be linked to the operator). */
create or replace function public.start_operation(target_order uuid, person uuid, op_seq int default null) returns uuid
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.people p where p.id = person and p.user_id = auth.uid()) then
    raise exception 'this operator is not linked to your sign-in; confirm with their operator PIN';
  end if;
  return public.start_operation_as(target_order, person, op_seq);
end;
$$;

/** Starts an operation on a shared terminal with the operator's PIN. A wrong PIN returns null (and is counted); nothing is booked. */
create function public.start_operation_pin(target_order uuid, person uuid, op_seq int, pin text) returns uuid
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.people p where p.id = person and public.can_write(p.company_id)) then raise exception 'not allowed'; end if;
  if not public.pin_ok(person, pin) then return null; end if;
  return public.start_operation_as(target_order, person, op_seq);
end;
$$;

/** Books a running operation as the signed-in person who runs it. */
create or replace function public.end_operation(active uuid, good int, scrap int, notes text default '') returns text
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.active_operations a join public.people p on p.id = a.person_id where a.id = end_operation.active and p.user_id = auth.uid()) then
    raise exception 'this operation runs for an operator who is not linked to your sign-in; confirm with their operator PIN';
  end if;
  return public.end_operation_as(end_operation.active, good, scrap, notes);
end;
$$;

/** Books a running operation on a shared terminal with the operator's PIN. A wrong PIN returns null (and is counted). */
create function public.end_operation_pin(active uuid, good int, scrap int, notes text, pin text) returns text
language plpgsql security definer set search_path = '' as $$
declare
  person uuid;
begin
  select a.person_id into person from public.active_operations a where a.id = end_operation_pin.active and public.can_write(a.company_id);
  if person is null then raise exception 'This operation is not running any more.'; end if;
  if not public.pin_ok(person, pin) then return null; end if;
  return public.end_operation_as(active, good, scrap, notes);
end;
$$;

/* ============================== P9: frozen job costs ============================== */

/** Closes a job when every operation is booked: Completed, with labour, overhead, material, rates and currency frozen. */
create or replace function public.complete_order(target_order uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  o public.production_orders%rowtype;
  c public.companies%rowtype;
  problem text;
  labour numeric;
  total_minutes numeric;
  overhead_rate numeric;
  material numeric;
  external numeric;
begin
  select * into o from public.production_orders where id = target_order for update;
  if not found or not public.can_write(o.company_id) then raise exception 'not allowed'; end if;
  if o.status = 'Completed' then return; end if;
  problem := public.completion_blocker(target_order);
  if problem is not null then raise exception '%', problem; end if;
  select * into c from public.companies where id = o.company_id;
  select round(coalesce(sum(l.minutes / 60 * coalesce(pp.hourly_rate, 0)), 0), 2), coalesce(sum(l.minutes), 0)
    into labour, total_minutes
  from public.operation_logs l left join public.people_pay pp on pp.person_id = l.person_id where l.order_id = target_order;
  overhead_rate := coalesce(nullif(c.settings ->> 'overhead_per_hour', '')::numeric, 0);
  select round(coalesce(sum(om.quantity * coalesce(i.cost, 0)), 0), 2) into material
  from public.order_materials om join public.items i on i.id = om.item_id where om.order_id = target_order;
  select round(coalesce(sum(d.subtotal), 0), 2) into external
  from public.purchase_documents d where o.project_id is not null and d.project_id = o.project_id and d.kind = 'bill' and d.category <> 'Raw material';
  update public.production_orders set status = 'Completed', completed_at = now(),
    cost_snapshot = jsonb_build_object('labour', labour, 'minutes', total_minutes, 'overhead_rate', overhead_rate, 'overhead', round(total_minutes / 60 * overhead_rate, 2),
      'material', material, 'external', external, 'currency', c.currency, 'fx', coalesce(c.settings -> 'fx', '{}'::jsonb), 'at', now())
  where id = target_order;
  insert into public.activity_log (company_id, module, action, entity_type, entity_id, summary)
  values (o.company_id, 'production', 'complete', 'production_order', o.id, o.number || ' completed; costs frozen');
end;
$$;

/* ============================== N14: activity written only by the database ============================== */

drop policy if exists activity_log_insert on public.activity_log;
revoke insert on public.activity_log from authenticated;

create function public.contacts_activity() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.activity_log (company_id, module, action, entity_type, entity_id, summary)
  values (new.company_id, 'contacts', 'create', 'contact', new.id,
    case when new.is_customer and new.is_supplier then 'Customer and supplier ' when new.is_customer then 'Customer ' when new.is_supplier then 'Supplier ' else 'Contact ' end || new.name || ' added');
  return null;
end;
$$;
create trigger contacts_activity after insert on public.contacts for each row execute function public.contacts_activity();

/* ============================== API access ============================== */

revoke execute on function public.document_number(uuid, text, text, date), public.next_number(uuid, text, text) from authenticated;

revoke execute on function
  public.assign_document_number(), public.close_books(uuid, date, text), public.issue_document_internal(uuid, text), public.issue_sales_document(uuid, text),
  public.stock_moves_guard(), public.adjust_stock(uuid, uuid, numeric, text), public.change_order_material(uuid, numeric, text), public.material_lots_guard(),
  public.correct_material_lot(uuid, text, text, text, text), public.people_guard(), public.set_person_pin(uuid, text), public.pin_ok(uuid, text),
  public.start_operation_as(uuid, uuid, int), public.end_operation_as(uuid, int, int, text), public.start_operation_pin(uuid, uuid, int, text),
  public.end_operation_pin(uuid, int, int, text, text), public.contacts_activity()
  from public;
do $$
declare
  r text;
begin
  foreach r in array array['anon', 'authenticated'] loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format('revoke execute on function public.assign_document_number(), public.issue_document_internal(uuid, text), public.pin_ok(uuid, text), public.start_operation_as(uuid, uuid, int), public.end_operation_as(uuid, int, int, text), public.contacts_activity() from %I', r);
    end if;
  end loop;
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke execute on function public.close_books(uuid, date, text), public.issue_sales_document(uuid, text), public.stock_moves_guard(), public.adjust_stock(uuid, uuid, numeric, text), public.change_order_material(uuid, numeric, text), public.material_lots_guard(), public.correct_material_lot(uuid, text, text, text, text), public.people_guard(), public.set_person_pin(uuid, text), public.start_operation_pin(uuid, uuid, int, text), public.end_operation_pin(uuid, int, int, text, text) from anon';
  end if;
end;
$$;
grant execute on function
  public.close_books(uuid, date, text), public.issue_sales_document(uuid, text), public.stock_moves_guard(), public.adjust_stock(uuid, uuid, numeric, text),
  public.change_order_material(uuid, numeric, text), public.material_lots_guard(), public.correct_material_lot(uuid, text, text, text, text), public.people_guard(),
  public.set_person_pin(uuid, text), public.start_operation_pin(uuid, uuid, int, text), public.end_operation_pin(uuid, int, int, text, text)
  to authenticated;
