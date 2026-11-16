-- Trade-show field notes for the /expo phone app. One row per company the signed-in user changed or added;
-- the target list itself ships with the app. Each user reads and writes only their own rows.

create table public.expo_contacts (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null check (length(id) between 1 and 80),
  data jsonb not null default '{}'::jsonb check (pg_column_size(data) < 60000),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);
alter table public.expo_contacts enable row level security;

create policy expo_contacts_read on public.expo_contacts for select using (user_id = auth.uid());
create policy expo_contacts_insert on public.expo_contacts for insert with check (user_id = auth.uid());
create policy expo_contacts_update on public.expo_contacts for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy expo_contacts_delete on public.expo_contacts for delete using (user_id = auth.uid());

revoke all on public.expo_contacts from anon;
grant select, insert, update, delete on public.expo_contacts to authenticated;
