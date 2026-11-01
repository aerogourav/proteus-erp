-- Website inquiries (leads). Visitors can only submit through submit_lead(); nobody can read leads through the
-- public API. The owner reads them in the Supabase dashboard (Table Editor → leads).

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null check (length(name) between 1 and 120),
  email text not null check (length(email) between 3 and 200),
  company text not null check (length(company) between 1 and 160),
  role text not null default '' check (length(role) <= 120),
  message text not null check (length(message) between 1 and 4000),
  source text not null default 'website',
  status text not null default 'new' check (status in ('new', 'contacted', 'qualified', 'not a fit'))
);
create index leads_email_idx on public.leads (lower(email), created_at desc);
alter table public.leads enable row level security;
-- No policies and no table grants: the API cannot read, change or delete leads.

/** Accepts one inquiry. Returns false (stores nothing) when the same email sent 3 in the last hour or the site gets a burst. */
create function public.submit_lead(lead_name text, lead_email text, lead_company text, lead_role text, lead_message text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  clean_email text := lower(trim(coalesce(lead_email, '')));
begin
  if length(trim(coalesce(lead_name, ''))) = 0 or length(trim(coalesce(lead_company, ''))) = 0 or length(trim(coalesce(lead_message, ''))) = 0 then
    raise exception 'missing fields';
  end if;
  if clean_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'invalid email';
  end if;
  if (select count(*) from public.leads where lower(email) = clean_email and created_at > now() - interval '1 hour') >= 3 then
    return false;
  end if;
  if (select count(*) from public.leads where created_at > now() - interval '10 minutes') >= 30 then
    return false;
  end if;
  insert into public.leads (name, email, company, role, message)
  values (left(trim(lead_name), 120), left(clean_email, 200), left(trim(lead_company), 160), left(trim(coalesce(lead_role, '')), 120), left(trim(lead_message), 4000));
  return true;
end;
$$;

revoke execute on function public.submit_lead(text, text, text, text, text) from public;
do $$
declare
  r text;
begin
  foreach r in array array['anon', 'authenticated'] loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format('grant execute on function public.submit_lead(text, text, text, text, text) to %I', r);
    end if;
  end loop;
end;
$$;
