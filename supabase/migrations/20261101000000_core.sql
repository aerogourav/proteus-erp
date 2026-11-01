-- BOH ERP core schema: companies, roles, and the records every industry pack shares.
-- Every business table carries company_id and is protected by row-level security:
-- a signed-in user only ever sees rows of companies they are a member of.
-- Industry-pack tables (production, fulfilment, subscriptions) come in later migrations.
-- gen_random_uuid() is built into Postgres 13+; no extension needed.

/* ============================== Companies and roles ============================== */

create table public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 160),
  industry text not null check (industry in ('manufacturing', 'commerce', 'saas')),
  currency char(3) not null default 'EUR',
  tax_rate numeric(5, 2) not null default 19,
  payment_terms_days int not null default 30 check (payment_terms_days between 0 and 365),
  settings jsonb not null default '{}'::jsonb,
  -- Sandbox demo companies are deleted by purge_expired_demos() after expires_at.
  is_demo boolean not null default false,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  check (not is_demo or expires_at is not null)
);

create table public.memberships (
  company_id uuid not null references public.companies (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'member', 'viewer')),
  created_at timestamptz not null default now(),
  primary key (company_id, user_id)
);
create index memberships_user_idx on public.memberships (user_id);

-- Role checks run as definer so policies on memberships do not recurse into themselves.
create function public.has_role(target uuid, roles text[]) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.memberships m
    where m.company_id = target and m.user_id = auth.uid() and m.role = any (roles)
  );
$$;

create function public.is_member(target uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.has_role(target, array['owner', 'admin', 'member', 'viewer']);
$$;

create function public.can_write(target uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.has_role(target, array['owner', 'admin', 'member']);
$$;

create function public.is_admin(target uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.has_role(target, array['owner', 'admin']);
$$;

/** Creates a company with the caller as owner. The only way a company comes into existence. */
create function public.create_company(company_name text, company_industry text, demo boolean default false)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  new_id uuid;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  insert into public.companies (name, industry, is_demo, expires_at)
  values (company_name, company_industry, demo, case when demo then now() + interval '7 days' end)
  returning id into new_id;
  insert into public.memberships (company_id, user_id, role) values (new_id, auth.uid(), 'owner');
  return new_id;
end;
$$;

/* ============================== Numbering ============================== */

-- Gap-free per company and kind ("QT-2026-0001"). Row lock makes concurrent calls safe.
create table public.counters (
  company_id uuid not null references public.companies (id) on delete cascade,
  kind text not null,
  next_value int not null default 1,
  primary key (company_id, kind)
);

create function public.next_number(target uuid, kind text, prefix text) returns text
language plpgsql security definer set search_path = '' as $$
declare
  value int;
begin
  if not public.can_write(target) then raise exception 'not allowed'; end if;
  insert into public.counters (company_id, kind) values (target, kind) on conflict do nothing;
  update public.counters c set next_value = c.next_value + 1
  where c.company_id = target and c.kind = next_number.kind
  returning c.next_value - 1 into value;
  return prefix || '-' || to_char(now(), 'YYYY') || '-' || lpad(value::text, 4, '0');
end;
$$;

/* ============================== People ============================== */

create table public.people (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  code text not null,
  name text not null,
  job_title text not null default '',
  department text not null default '',
  email text not null default '',
  active boolean not null default true,
  joined_at date,
  created_at timestamptz not null default now(),
  unique (company_id, code)
);

-- Pay is kept apart so only owners and admins can read it.
create table public.people_pay (
  person_id uuid primary key references public.people (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  pay_type text not null check (pay_type in ('salary', 'hourly')),
  hourly_rate numeric(12, 2),
  monthly_salary numeric(12, 2)
);

/* ============================== Contacts and items ============================== */

-- Customers and suppliers are one table: a company can be both.
create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  is_customer boolean not null default false,
  is_supplier boolean not null default false,
  email text not null default '',
  phone text not null default '',
  contact_person text not null default '',
  tax_id text not null default '',
  address jsonb not null default '{}'::jsonb,
  payment_terms_days int,
  lead_time_days int,
  custom jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  archived_at timestamptz,
  unique (id, company_id)
);
create index contacts_company_idx on public.contacts (company_id, name);

-- Parts, raw materials, products, variants, services and subscription plans.
create table public.items (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  kind text not null check (kind in ('part', 'material', 'product', 'variant', 'service', 'plan')),
  parent_id uuid,
  sku text not null,
  name text not null,
  unit text not null default 'pcs',
  sale_price numeric(14, 4),
  cost numeric(14, 4),
  revision text,
  attributes jsonb not null default '{}'::jsonb,
  track_stock boolean not null default false,
  reorder_level numeric(14, 3),
  default_supplier_id uuid,
  billing_interval text check (billing_interval in ('month', 'year')),
  custom jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  archived_at timestamptz,
  unique (company_id, sku),
  unique (id, company_id),
  foreign key (parent_id, company_id) references public.items (id, company_id),
  foreign key (default_supplier_id, company_id) references public.contacts (id, company_id),
  check (kind <> 'variant' or parent_id is not null),
  check (kind = 'plan' or billing_interval is null)
);

/* ============================== Stock (a ledger, never overwritten) ============================== */

create table public.warehouses (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  code text not null,
  name text not null,
  unique (company_id, code),
  unique (id, company_id)
);

create table public.stock_moves (
  id bigint generated always as identity primary key,
  company_id uuid not null references public.companies (id) on delete cascade,
  item_id uuid not null,
  warehouse_id uuid not null,
  quantity numeric(14, 3) not null check (quantity <> 0),
  reason text not null check (reason in ('receipt', 'issue', 'sale', 'return', 'adjustment', 'transfer')),
  ref_type text,
  ref_id uuid,
  note text not null default '',
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  foreign key (item_id, company_id) references public.items (id, company_id),
  foreign key (warehouse_id, company_id) references public.warehouses (id, company_id)
);
create index stock_moves_item_idx on public.stock_moves (company_id, item_id, warehouse_id);

create view public.stock_levels with (security_invoker = true) as
  select company_id, item_id, warehouse_id, sum(quantity) as on_hand
  from public.stock_moves group by company_id, item_id, warehouse_id;

/* ============================== Projects ============================== */

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  code text not null,
  name text not null,
  description text not null default '',
  contact_id uuid,
  stage text not null default 'New',
  due_date date,
  custom jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (company_id, code),
  unique (id, company_id),
  foreign key (contact_id, company_id) references public.contacts (id, company_id)
);

/* ============================== Sales: quote → order → invoice ============================== */

create table public.sales_documents (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  kind text not null check (kind in ('quote', 'order', 'invoice', 'credit_note')),
  number text not null,
  customer_ref text not null default '',
  contact_id uuid not null,
  project_id uuid,
  source_id uuid,
  status text not null default 'Draft',
  issue_date date not null default current_date,
  due_date date,
  currency char(3) not null default 'EUR',
  subtotal numeric(14, 2) not null default 0,
  tax numeric(14, 2) not null default 0,
  total numeric(14, 2) not null default 0,
  notes text not null default '',
  custom jsonb not null default '{}'::jsonb,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  unique (company_id, kind, number),
  unique (id, company_id),
  foreign key (contact_id, company_id) references public.contacts (id, company_id),
  foreign key (project_id, company_id) references public.projects (id, company_id),
  foreign key (source_id, company_id) references public.sales_documents (id, company_id)
);
create index sales_documents_company_idx on public.sales_documents (company_id, kind, issue_date desc);

create table public.sales_lines (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  document_id uuid not null,
  position int not null default 0,
  item_id uuid,
  description text not null default '',
  quantity numeric(14, 3) not null check (quantity > 0),
  unit text not null default 'pcs',
  unit_price numeric(14, 4) not null default 0,
  tax_rate numeric(5, 2) not null default 0,
  foreign key (document_id, company_id) references public.sales_documents (id, company_id) on delete cascade,
  foreign key (item_id, company_id) references public.items (id, company_id)
);

/* ============================== Purchasing: supplier order → bill ============================== */

create table public.purchase_documents (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  kind text not null check (kind in ('order', 'bill')),
  number text not null,
  supplier_ref text not null default '',
  contact_id uuid not null,
  project_id uuid,
  source_id uuid,
  status text not null default 'Draft',
  category text not null default 'Other',
  issue_date date not null default current_date,
  due_date date,
  expected_date date,
  currency char(3) not null default 'EUR',
  subtotal numeric(14, 2) not null default 0,
  tax numeric(14, 2) not null default 0,
  total numeric(14, 2) not null default 0,
  notes text not null default '',
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  unique (company_id, kind, number),
  unique (id, company_id),
  foreign key (contact_id, company_id) references public.contacts (id, company_id),
  foreign key (project_id, company_id) references public.projects (id, company_id),
  foreign key (source_id, company_id) references public.purchase_documents (id, company_id)
);

create table public.purchase_lines (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  document_id uuid not null,
  position int not null default 0,
  item_id uuid,
  description text not null default '',
  quantity numeric(14, 3) not null check (quantity > 0),
  unit text not null default 'pcs',
  unit_price numeric(14, 4),
  tax_rate numeric(5, 2) not null default 0,
  foreign key (document_id, company_id) references public.purchase_documents (id, company_id) on delete cascade,
  foreign key (item_id, company_id) references public.items (id, company_id)
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  direction text not null check (direction in ('in', 'out')),
  contact_id uuid not null,
  amount numeric(14, 2) not null check (amount > 0),
  currency char(3) not null default 'EUR',
  paid_on date not null default current_date,
  method text not null default 'bank transfer',
  sales_document_id uuid,
  purchase_document_id uuid,
  reference text not null default '',
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  foreign key (contact_id, company_id) references public.contacts (id, company_id),
  foreign key (sales_document_id, company_id) references public.sales_documents (id, company_id),
  foreign key (purchase_document_id, company_id) references public.purchase_documents (id, company_id),
  check ((direction = 'in' and purchase_document_id is null) or (direction = 'out' and sales_document_id is null))
);

/* ============================== Files and the activity log ============================== */

-- File bytes live in Supabase Storage under <company_id>/...; this row is the record and its approval state.
create table public.files (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  storage_path text not null,
  name text not null,
  mime text not null default 'application/octet-stream',
  size_bytes bigint not null default 0,
  doc_type text not null default 'Other',
  number text not null default '',
  revision text not null default '',
  status text not null default 'Draft' check (status in ('Draft', 'In review', 'Approved', 'Superseded')),
  linked_type text,
  linked_id uuid,
  approved_by uuid,
  approved_at timestamptz,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  check (storage_path like company_id::text || '/%'),
  check ((status = 'Approved') = (approved_at is not null))
);

-- Append-only: there are no update or delete policies, so history cannot be rewritten from the app.
create table public.activity_log (
  id bigint generated always as identity primary key,
  company_id uuid not null references public.companies (id) on delete cascade,
  at timestamptz not null default now(),
  actor uuid default auth.uid(),
  module text not null,
  action text not null,
  entity_type text,
  entity_id uuid,
  summary text not null,
  data jsonb not null default '{}'::jsonb
);
create index activity_log_company_idx on public.activity_log (company_id, at desc);

/* ============================== Row-level security ============================== */

alter table public.companies enable row level security;
alter table public.memberships enable row level security;
alter table public.counters enable row level security;

create policy companies_read on public.companies for select using (public.is_member(id));
create policy companies_update on public.companies for update using (public.is_admin(id)) with check (public.is_admin(id));
create policy companies_delete on public.companies for delete using (public.has_role(id, array['owner']));
-- No insert policy: companies are created through create_company().

create policy memberships_read on public.memberships for select using (public.is_member(company_id));
create policy memberships_admin_insert on public.memberships for insert with check (public.is_admin(company_id) and role <> 'owner');
create policy memberships_admin_update on public.memberships for update using (public.is_admin(company_id) and role <> 'owner') with check (public.is_admin(company_id) and role <> 'owner');
create policy memberships_admin_delete on public.memberships for delete using (public.is_admin(company_id) and role <> 'owner');
-- counters: no policies; only next_number() (security definer) touches them.

alter table public.people_pay enable row level security;
create policy people_pay_admin on public.people_pay for all using (public.is_admin(company_id)) with check (public.is_admin(company_id));

-- Ordinary business tables: members read, members (not viewers) write, admins delete.
do $$
declare
  t text;
begin
  foreach t in array array['people', 'contacts', 'items', 'warehouses', 'projects', 'sales_documents', 'sales_lines', 'purchase_documents', 'purchase_lines', 'payments', 'files'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I on public.%I for select using (public.is_member(company_id))', t || '_read', t);
    execute format('create policy %I on public.%I for insert with check (public.can_write(company_id))', t || '_insert', t);
    execute format('create policy %I on public.%I for update using (public.can_write(company_id)) with check (public.can_write(company_id))', t || '_update', t);
    execute format('create policy %I on public.%I for delete using (public.is_admin(company_id))', t || '_delete', t);
  end loop;
  -- Ledgers: read and append only.
  foreach t in array array['stock_moves', 'activity_log'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I on public.%I for select using (public.is_member(company_id))', t || '_read', t);
    execute format('create policy %I on public.%I for insert with check (public.can_write(company_id))', t || '_insert', t);
  end loop;
end;
$$;

-- Activity is always attributed to the real signed-in user, whatever the client sends.
create function public.stamp_actor() returns trigger language plpgsql as $$
begin
  new.actor := auth.uid();
  new.at := now();
  return new;
end;
$$;
create trigger activity_log_stamp before insert on public.activity_log for each row execute function public.stamp_actor();

/* ============================== Demo sandboxes ============================== */

/** Deletes expired demo companies and everything in them (all tables cascade). Run daily by a scheduled job. */
create function public.purge_expired_demos() returns int
language plpgsql security definer set search_path = '' as $$
declare
  removed int;
begin
  delete from public.companies where is_demo and expires_at < now();
  get diagnostics removed = row_count;
  return removed;
end;
$$;
-- Supabase grants anon and authenticated execute on new functions explicitly, so revoking from public is not enough.
revoke execute on function public.purge_expired_demos() from public;
do $$
declare
  r text;
begin
  foreach r in array array['anon', 'authenticated'] loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format('revoke execute on function public.purge_expired_demos() from %I', r);
    end if;
  end loop;
end;
$$;

/* ============================== API access ============================== */

-- The project does not expose new tables automatically, so access is granted here explicitly:
-- signed-in users (authenticated) reach tables only through the row-level security policies above;
-- signed-out visitors (anon) get no table access and cannot call any function.
revoke all on all tables in schema public from anon;
revoke execute on all functions in schema public from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke execute on all functions in schema public from anon';
  end if;
end;
$$;

grant usage on schema public to authenticated;
grant select, insert, update, delete on
  public.companies, public.memberships, public.people, public.people_pay, public.contacts, public.items, public.warehouses,
  public.projects, public.sales_documents, public.sales_lines, public.purchase_documents, public.purchase_lines, public.payments, public.files
  to authenticated;
-- Ledgers: read and append only, at the privilege level too.
grant select, insert on public.stock_moves, public.activity_log to authenticated;
grant select on public.stock_levels to authenticated;
grant usage on all sequences in schema public to authenticated;
grant execute on function
  public.has_role(uuid, text[]), public.is_member(uuid), public.can_write(uuid), public.is_admin(uuid),
  public.create_company(text, text, boolean), public.next_number(uuid, text, text), public.stamp_actor()
  to authenticated;
