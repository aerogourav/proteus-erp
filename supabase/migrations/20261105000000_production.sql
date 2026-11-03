-- Phase 4: the job release workflow in the database. Additive only.
-- The same rules as the demo (src/lib/erp/model.ts, src/lib/erp/shopfloor.ts), enforced here so no client can skip them:
--  * A job starts only with an approved drawing for the ordered revision, a routing, and its material in stock.
--    A newer drawing revision stops further operations. Owners and admins may override with a reason (logged).
--  * Good + scrap at an operation never exceeds the parts that arrived there. Partial bookings, several shifts,
--    split work and parallel operators are allowed.
--  * A job completes only when every routing operation is booked and none is running; its labour cost is then frozen.
--  * Inspections need a value, an explicit pass or fail and a sample size; a value outside a readable tolerance fails.
-- Operation logs and inspections are written only by these functions and can never be changed through the API.
-- Drawings are rows in public.files (doc_type 'Drawing', linked_type 'item', linked_id = the part, revision).

/* ============================== Tables ============================== */

create table public.routing_operations (
  company_id uuid not null references public.companies (id) on delete cascade,
  item_id uuid not null,
  seq int not null check (seq > 0),
  name text not null check (length(trim(name)) > 0),
  work_center text not null default '',
  setup_min numeric(10, 2) not null default 0 check (setup_min >= 0),
  run_min_per_pc numeric(10, 2) not null default 0 check (run_min_per_pc >= 0),
  primary key (item_id, seq),
  foreign key (item_id, company_id) references public.items (id, company_id) on delete cascade
);

create table public.production_orders (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  number text not null default '',
  project_id uuid,
  item_id uuid not null,
  revision text not null check (length(trim(revision)) > 0),
  quantity int not null check (quantity > 0),
  status text not null default 'Planned' check (status in ('Planned', 'Running', 'On hold', 'Completed')),
  notes text not null default '',
  routing jsonb,
  material_issued_at timestamptz,
  release_override jsonb,
  completed_at timestamptz,
  cost_snapshot jsonb,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  unique (company_id, number),
  unique (id, company_id),
  foreign key (item_id, company_id) references public.items (id, company_id),
  foreign key (project_id, company_id) references public.projects (id, company_id)
);

create table public.order_materials (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  order_id uuid not null,
  item_id uuid not null,
  warehouse_id uuid not null,
  quantity numeric(14, 3) not null check (quantity > 0),
  foreign key (order_id, company_id) references public.production_orders (id, company_id) on delete cascade,
  foreign key (item_id, company_id) references public.items (id, company_id),
  foreign key (warehouse_id, company_id) references public.warehouses (id, company_id)
);

create table public.active_operations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  order_id uuid not null,
  seq int not null,
  person_id uuid not null references public.people (id),
  started_at timestamptz not null default now(),
  foreign key (order_id, company_id) references public.production_orders (id, company_id) on delete cascade
);

create table public.operation_logs (
  id bigint generated always as identity primary key,
  company_id uuid not null,
  order_id uuid not null,
  seq int not null,
  operation text not null,
  work_center text not null default '',
  person_id uuid not null references public.people (id),
  started_at timestamptz not null,
  ended_at timestamptz not null,
  minutes numeric(10, 1) not null,
  planned_minutes numeric(10, 1) not null,
  qty_good int not null check (qty_good >= 0),
  qty_scrap int not null check (qty_scrap >= 0),
  notes text not null default '',
  created_by uuid default auth.uid(),
  check (qty_good + qty_scrap > 0),
  foreign key (order_id, company_id) references public.production_orders (id, company_id)
);

create table public.inspections (
  id bigint generated always as identity primary key,
  company_id uuid not null,
  order_id uuid not null,
  characteristic text not null,
  spec text not null default '',
  unit text not null default '',
  observed text not null,
  result text not null check (result in ('pass', 'fail')),
  tolerance text not null check (tolerance in ('in', 'out', 'unknown')),
  passed boolean not null,
  sample_size int not null check (sample_size >= 1),
  gauge_id text not null default '',
  inspected_by uuid default auth.uid(),
  at timestamptz not null default now(),
  check (not passed or (result = 'pass' and tolerance <> 'out')),
  foreign key (order_id, company_id) references public.production_orders (id, company_id)
);

create table public.material_lots (
  company_id uuid not null,
  order_id uuid not null,
  material text not null check (length(trim(material)) > 0),
  heat text not null check (length(trim(heat)) > 0),
  certificate text not null default '',
  linked_by uuid default auth.uid(),
  linked_at timestamptz not null default now(),
  primary key (order_id, material),
  foreign key (order_id, company_id) references public.production_orders (id, company_id) on delete cascade
);

/* ============================== Rule functions ============================== */

/** True when revision a is later than b: numbers numerically, letters by length then alphabet (Z before AA). */
create function public.revision_newer(a text, b text) returns boolean
language sql immutable set search_path = '' as $$
  select case
    when upper(trim(a)) ~ '^\d+$' and upper(trim(b)) ~ '^\d+$' then trim(a)::numeric > trim(b)::numeric
    else length(trim(a)) > length(trim(b)) or (length(trim(a)) = length(trim(b)) and upper(trim(a)) collate "C" > upper(trim(b)) collate "C")
  end;
$$;

/**
 * Checks a measured value against a specification it can read: "120.00 ± 0.05", "20 +0.1/-0.05", "8–12", "≤ 0.05", "min 3".
 * Fits such as "Ø40 H8" and text specifications return 'unknown'. Same behaviour as toleranceCheck() in src/lib/erp/model.ts.
 */
create function public.tolerance_check(spec text, observed text) returns text
language plpgsql immutable set search_path = '' as $$
declare
  num constant text := '(-?\d+(?:\.\d+)?)';
  t text := regexp_replace(regexp_replace(coalesce(spec, ''), '(\d),(\d)', '\1.\2', 'g'), '\s+', ' ', 'g');
  m text[];
  v numeric;
  lo numeric;
  hi numeric;
begin
  m := regexp_match(regexp_replace(coalesce(observed, ''), '(\d),(\d)', '\1.\2', 'g'), '-?\d+(?:\.\d+)?');
  if m is null then return 'unknown'; end if;
  v := m[1]::numeric;
  m := regexp_match(t, num || ' ?± ?' || num);
  if m is not null then lo := m[1]::numeric - m[2]::numeric; hi := m[1]::numeric + m[2]::numeric;
  else
    m := regexp_match(t, num || ' ?\+ ?' || num || ' ?/ ?- ?' || num);
    if m is not null then lo := m[1]::numeric - m[3]::numeric; hi := m[1]::numeric + m[2]::numeric;
    else
      m := regexp_match(t, '(?:≤|<=|max\.?) ?' || num, 'i');
      if m is not null then lo := null; hi := m[1]::numeric;
      else
        m := regexp_match(t, '(?:≥|>=|min\.?) ?' || num, 'i');
        if m is not null then lo := m[1]::numeric; hi := null;
        else
          m := regexp_match(t, '^[^\d-]*' || num || ' ?(?:–|-|to) ?' || num);
          if m is null then return 'unknown'; end if;
          lo := m[1]::numeric; hi := m[2]::numeric;
        end if;
      end if;
    end if;
  end if;
  return case when (lo is null or v >= lo) and (hi is null or v <= hi) then 'in' else 'out' end;
end;
$$;

/** The saved routing of a part as a JSON array, ordered by operation number. Empty when none is saved. */
create function public.item_routing(target_item uuid) returns jsonb
language sql stable set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('seq', r.seq, 'name', r.name, 'work_center', r.work_center, 'setup_min', r.setup_min, 'run_min_per_pc', r.run_min_per_pc) order by r.seq), '[]'::jsonb)
  from public.routing_operations r where r.item_id = target_item;
$$;

/**
 * Progress per operation: parts arrive as the good parts of the operation before (so far); an operation is done
 * once everything that can arrive is booked as good or scrap.
 */
create function public.order_progress(target_order uuid)
returns table (seq int, name text, work_center text, setup_min numeric, run_min_per_pc numeric, incoming int, booked int, good int, scrap int, remaining int, done boolean, running int)
language plpgsql stable set search_path = '' as $$
declare
  o public.production_orders%rowtype;
  op record;
  prev_good int;
  prev_done boolean := true;
  g int;
  s int;
begin
  select * into o from public.production_orders p where p.id = target_order;
  if not found then return; end if;
  prev_good := o.quantity;
  for op in
    select (x ->> 'seq')::int as op_seq, x ->> 'name' as op_name, coalesce(x ->> 'work_center', '') as op_wc,
           coalesce((x ->> 'setup_min')::numeric, 0) as op_setup, coalesce((x ->> 'run_min_per_pc')::numeric, 0) as op_run
    from jsonb_array_elements(coalesce(o.routing, public.item_routing(o.item_id))) x
    order by (x ->> 'seq')::int
  loop
    select coalesce(sum(l.qty_good), 0), coalesce(sum(l.qty_scrap), 0) into g, s from public.operation_logs l where l.order_id = o.id and l.seq = op.op_seq;
    seq := op.op_seq; name := op.op_name; work_center := op.op_wc; setup_min := op.op_setup; run_min_per_pc := op.op_run;
    incoming := prev_good; booked := g + s; good := g; scrap := s;
    remaining := greatest(0, prev_good - g - s);
    done := prev_done and g + s >= prev_good;
    select count(*)::int into running from public.active_operations a where a.order_id = o.id and a.seq = op.op_seq;
    prev_good := g;
    prev_done := done;
    return next;
  end loop;
end;
$$;

/** Everything that stops a job from starting or continuing. Empty array when the job may run. */
create function public.release_blockers(target_order uuid) returns text[]
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
  select f.number, f.revision, f.status into d from public.files f
  where f.company_id = o.company_id and f.doc_type = 'Drawing' and f.linked_type = 'item' and f.linked_id = o.item_id and upper(trim(f.revision)) = upper(trim(o.revision))
  order by (f.status = 'Approved') desc, f.created_at desc limit 1;
  if not found then blockers := blockers || format('No drawing for %s rev %s.', sku, o.revision);
  elsif d.status <> 'Approved' then blockers := blockers || format('Drawing %s rev %s is not approved (%s).', d.number, d.revision, lower(d.status));
  end if;
  for d in select f.number, f.revision from public.files f
    where f.company_id = o.company_id and f.doc_type = 'Drawing' and f.linked_type = 'item' and f.linked_id = o.item_id and public.revision_newer(f.revision, o.revision)
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

/** The first blocker not covered by a release override, or null when the job may run. */
create function public.release_gate(target_order uuid) returns text
language sql stable set search_path = '' as $$
  select b from public.production_orders o, unnest(public.release_blockers(o.id)) b
  where o.id = target_order and not coalesce((o.release_override -> 'blockers') ? b, false)
  limit 1;
$$;

/** Why a job cannot be completed, or null. */
create function public.completion_blocker(target_order uuid) returns text
language sql stable set search_path = '' as $$
  select coalesce(
    (select format('Op %s %s is still running.', x.seq, x.name) from public.order_progress(target_order) x where x.running > 0 order by x.seq limit 1),
    (select format('Op %s %s is not booked in full (%s of %s parts).', x.seq, x.name, x.booked, x.incoming) from public.order_progress(target_order) x where not x.done order by x.seq limit 1),
    case when not exists (select 1 from public.order_progress(target_order)) then 'The order has no routing.' end
  );
$$;

/* ============================== Controlled actions ============================== */

/** Releases a job despite its current blockers. Owner or admin, reason required; covers only the blockers listed. */
create function public.override_release(target_order uuid, reason text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  o public.production_orders%rowtype;
  blockers text[];
begin
  select * into o from public.production_orders where id = target_order for update;
  if not found or not public.is_admin(o.company_id) then raise exception 'only an owner or admin of this company can override the release check'; end if;
  if length(trim(coalesce(reason, ''))) < 5 then raise exception 'give a reason of at least a few words'; end if;
  if o.status = 'Completed' then raise exception '% is closed', o.number; end if;
  blockers := public.release_blockers(target_order);
  if cardinality(blockers) = 0 then raise exception 'nothing to override'; end if;
  update public.production_orders set release_override = jsonb_build_object('by', auth.uid(), 'reason', trim(reason), 'at', now(), 'blockers', to_jsonb(blockers)) where id = target_order;
  insert into public.activity_log (company_id, module, action, entity_type, entity_id, summary, data)
  values (o.company_id, 'production', 'override', 'production_order', o.id, 'Release override for ' || o.number || ': ' || trim(reason), jsonb_build_object('blockers', to_jsonb(blockers)));
end;
$$;

/** Closes a job when every operation is booked: Completed, labour cost frozen. */
create function public.complete_order(target_order uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  o public.production_orders%rowtype;
  problem text;
  labour numeric;
  total_minutes numeric;
begin
  select * into o from public.production_orders where id = target_order for update;
  if not found or not public.can_write(o.company_id) then raise exception 'not allowed'; end if;
  if o.status = 'Completed' then return; end if;
  problem := public.completion_blocker(target_order);
  if problem is not null then raise exception '%', problem; end if;
  select round(coalesce(sum(l.minutes / 60 * coalesce(pp.hourly_rate, 0)), 0), 2), coalesce(sum(l.minutes), 0)
    into labour, total_minutes
  from public.operation_logs l left join public.people_pay pp on pp.person_id = l.person_id where l.order_id = target_order;
  update public.production_orders set status = 'Completed', completed_at = now(),
    cost_snapshot = jsonb_build_object('labour', labour, 'minutes', total_minutes, 'at', now()) where id = target_order;
  insert into public.activity_log (company_id, module, action, entity_type, entity_id, summary)
  values (o.company_id, 'production', 'complete', 'production_order', o.id, o.number || ' completed; costs frozen');
end;
$$;

/** Planned (nothing booked yet), Running (release gate), On hold, Completed (every operation booked). Nothing else. */
create function public.set_order_status(target_order uuid, new_status text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  o public.production_orders%rowtype;
  gate text;
begin
  select * into o from public.production_orders where id = target_order for update;
  if not found or not public.can_write(o.company_id) then raise exception 'not allowed'; end if;
  if new_status not in ('Planned', 'Running', 'On hold', 'Completed') then raise exception '"%" is not a production status', new_status; end if;
  if o.status = new_status then return; end if;
  if o.status = 'Completed' then raise exception '% is closed', o.number; end if;
  if new_status = 'Completed' then perform public.complete_order(target_order); return; end if;
  if new_status = 'Running' then
    gate := public.release_gate(target_order);
    if gate is not null then raise exception '%', gate; end if;
  end if;
  if new_status = 'Planned' and (exists (select 1 from public.operation_logs l where l.order_id = o.id) or exists (select 1 from public.active_operations a where a.order_id = o.id)) then
    raise exception 'work has been booked, so the order cannot go back to Planned';
  end if;
  update public.production_orders set status = new_status where id = target_order;
  insert into public.activity_log (company_id, module, action, entity_type, entity_id, summary)
  values (o.company_id, 'production', 'status', 'production_order', o.id, o.number || ' status: ' || new_status);
end;
$$;

/** Starts an operation for a person. The release gate applies to every start. Returns the running operation's id. */
create function public.start_operation(target_order uuid, person uuid, op_seq int default null) returns uuid
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
    update public.production_orders set material_issued_at = now() where id = target_order;
  end if;
  insert into public.activity_log (company_id, module, action, entity_type, entity_id, summary)
  values (o.company_id, 'shopfloor', 'start', 'production_order', o.id, o.number || ' · Op ' || chosen.seq || ' ' || chosen.name || ' started by ' || p.name || ' (' || p.code || ')');
  return act;
end;
$$;

/** Books what one person did. Partial quantities are fine; good + scrap may not exceed the parts waiting. Completes the job when everything is booked. */
create function public.end_operation(active uuid, good int, scrap int, notes text default '') returns text
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

/**
 * Records an inspection of a completed job. results: [{characteristic, spec, unit, observed, result: "pass"|"fail", sample_size, gauge_id}].
 * Every entry needs a value, an explicit result and a sample size. Returns true when everything passed.
 */
create function public.record_inspection(target_order uuid, results jsonb) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  o public.production_orders%rowtype;
  r jsonb;
  tol text;
  ok boolean;
  all_ok boolean := true;
begin
  select * into o from public.production_orders where id = target_order;
  if not found or not public.can_write(o.company_id) then raise exception 'not allowed'; end if;
  if o.status <> 'Completed' then raise exception 'every routing operation must be booked before the inspection is recorded'; end if;
  if jsonb_typeof(results) <> 'array' or jsonb_array_length(results) = 0 then raise exception 'add at least one inspection result'; end if;
  for r in select value from jsonb_array_elements(results) loop
    if length(trim(coalesce(r ->> 'characteristic', ''))) = 0 then raise exception 'name every characteristic'; end if;
    if length(trim(coalesce(r ->> 'observed', ''))) = 0 then raise exception 'enter the measured value for %', r ->> 'characteristic'; end if;
    if coalesce(r ->> 'result', '') not in ('pass', 'fail') then raise exception 'choose pass or fail for %', r ->> 'characteristic'; end if;
    if coalesce((r ->> 'sample_size')::int, 0) < 1 then raise exception 'enter how many parts were measured for %', r ->> 'characteristic'; end if;
    tol := public.tolerance_check(r ->> 'spec', r ->> 'observed');
    ok := r ->> 'result' = 'pass' and tol <> 'out';
    all_ok := all_ok and ok;
    insert into public.inspections (company_id, order_id, characteristic, spec, unit, observed, result, tolerance, passed, sample_size, gauge_id)
    values (o.company_id, o.id, trim(r ->> 'characteristic'), coalesce(r ->> 'spec', ''), coalesce(r ->> 'unit', ''), trim(r ->> 'observed'), r ->> 'result', tol, ok, (r ->> 'sample_size')::int, coalesce(trim(r ->> 'gauge_id'), ''));
  end loop;
  insert into public.activity_log (company_id, module, action, entity_type, entity_id, summary)
  values (o.company_id, 'quality', 'inspect', 'production_order', o.id, 'Inspection of ' || o.number || ': ' || case when all_ok then 'passed' else 'failed' end);
  return all_ok;
end;
$$;

/* ============================== Guards on direct writes ============================== */

create function public.production_orders_guard() returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if public.is_api_role() and (new.status <> 'Planned' or new.routing is not null or new.material_issued_at is not null or new.release_override is not null or new.completed_at is not null or new.cost_snapshot is not null) then
      raise exception 'new production orders start as Planned; status changes go through the production functions';
    end if;
    if coalesce(new.number, '') = '' then new.number := public.document_number(new.company_id, 'production_order', 'MO', new.created_at::date); end if;
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
create trigger production_orders_guard before insert or update or delete on public.production_orders for each row execute function public.production_orders_guard();

create function public.order_materials_guard() returns trigger language plpgsql set search_path = '' as $$
declare
  target uuid := case when tg_op = 'DELETE' then old.order_id else new.order_id end;
begin
  if public.is_api_role() and exists (select 1 from public.production_orders p where p.id = target and p.material_issued_at is not null) then
    raise exception 'material has been issued to this order and can no longer change';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;
create trigger order_materials_guard before insert or update or delete on public.order_materials for each row execute function public.order_materials_guard();

create function public.stamp_linked_by() returns trigger language plpgsql set search_path = '' as $$
begin
  new.linked_by := auth.uid();
  new.linked_at := now();
  return new;
end;
$$;
create trigger material_lots_stamp before insert or update on public.material_lots for each row execute function public.stamp_linked_by();

/* ============================== Row-level security, audit and API access ============================== */

do $$
declare
  t text;
begin
  foreach t in array array['routing_operations', 'production_orders', 'order_materials', 'active_operations', 'operation_logs', 'inspections', 'material_lots'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I on public.%I for select using (public.is_member(company_id))', t || '_read', t);
  end loop;
  -- Ordinary edits for members; deletes for admins. Logs, inspections and running operations: functions only.
  foreach t in array array['routing_operations', 'production_orders', 'order_materials', 'material_lots'] loop
    execute format('create policy %I on public.%I for insert with check (public.can_write(company_id))', t || '_insert', t);
    execute format('create policy %I on public.%I for update using (public.can_write(company_id)) with check (public.can_write(company_id))', t || '_update', t);
    execute format('create policy %I on public.%I for delete using (public.is_admin(company_id))', t || '_delete', t);
  end loop;
  foreach t in array array['routing_operations', 'production_orders', 'order_materials', 'material_lots', 'operation_logs', 'inspections'] loop
    execute format('create trigger %I after insert or update or delete on public.%I for each row execute function public.audit_row()', t || '_audit', t);
  end loop;
end;
$$;

grant select, insert, update, delete on public.routing_operations, public.production_orders, public.order_materials, public.material_lots to authenticated;
grant select on public.active_operations, public.operation_logs, public.inspections to authenticated;

revoke execute on function
  public.revision_newer(text, text), public.tolerance_check(text, text), public.item_routing(uuid), public.order_progress(uuid), public.release_blockers(uuid),
  public.release_gate(uuid), public.completion_blocker(uuid), public.override_release(uuid, text), public.complete_order(uuid), public.set_order_status(uuid, text),
  public.start_operation(uuid, uuid, int), public.end_operation(uuid, int, int, text), public.record_inspection(uuid, jsonb),
  public.production_orders_guard(), public.order_materials_guard(), public.stamp_linked_by()
  from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke execute on function public.revision_newer(text, text), public.tolerance_check(text, text), public.item_routing(uuid), public.order_progress(uuid), public.release_blockers(uuid), public.release_gate(uuid), public.completion_blocker(uuid), public.override_release(uuid, text), public.complete_order(uuid), public.set_order_status(uuid, text), public.start_operation(uuid, uuid, int), public.end_operation(uuid, int, int, text), public.record_inspection(uuid, jsonb), public.production_orders_guard(), public.order_materials_guard(), public.stamp_linked_by() from anon';
  end if;
end;
$$;
grant execute on function
  public.revision_newer(text, text), public.tolerance_check(text, text), public.item_routing(uuid), public.order_progress(uuid), public.release_blockers(uuid),
  public.release_gate(uuid), public.completion_blocker(uuid), public.override_release(uuid, text), public.complete_order(uuid), public.set_order_status(uuid, text),
  public.start_operation(uuid, uuid, int), public.end_operation(uuid, int, int, text), public.record_inspection(uuid, jsonb),
  public.production_orders_guard(), public.order_materials_guard(), public.stamp_linked_by()
  to authenticated;
