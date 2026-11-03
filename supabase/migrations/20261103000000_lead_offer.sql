-- Additive: records which free offer a website inquiry is about (workflow call, demo walkthrough or 2-week pilot).
-- Existing leads keep working: they get offer 'call', and the original submit_lead() stays in place unchanged.

alter table public.leads add column if not exists offer text not null default 'call';
alter table public.leads drop constraint if exists leads_offer_check;
alter table public.leads add constraint leads_offer_check check (offer in ('call', 'walkthrough', 'pilot'));

/** Same rules as submit_lead(), plus the chosen offer. Returns false (stores nothing) when rate limited. */
create or replace function public.submit_lead_with_offer(lead_name text, lead_email text, lead_company text, lead_role text, lead_message text, lead_offer text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  clean_email text := lower(trim(coalesce(lead_email, '')));
begin
  if length(trim(coalesce(lead_name, ''))) = 0 or length(trim(coalesce(lead_company, ''))) = 0 or length(trim(coalesce(lead_message, ''))) = 0 then
    raise exception 'missing fields';
  end if;
  if coalesce(lead_offer, '') not in ('call', 'walkthrough', 'pilot') then
    raise exception 'invalid offer';
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
  insert into public.leads (name, email, company, role, message, offer)
  values (left(trim(lead_name), 120), left(clean_email, 200), left(trim(lead_company), 160), left(trim(coalesce(lead_role, '')), 120), left(trim(lead_message), 4000), lead_offer);
  return true;
end;
$$;

revoke execute on function public.submit_lead_with_offer(text, text, text, text, text, text) from public;
do $$
declare
  r text;
begin
  foreach r in array array['anon', 'authenticated'] loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format('grant execute on function public.submit_lead_with_offer(text, text, text, text, text, text) to %I', r);
    end if;
  end loop;
end;
$$;
