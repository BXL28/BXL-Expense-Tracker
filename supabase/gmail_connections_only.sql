-- Run this in Supabase → SQL Editor if you see:
-- "Could not find the table 'public.gmail_connections'"

create table if not exists public.gmail_connections (
  id bigint generated always as identity primary key,
  user_id uuid not null unique references auth.users (id) on delete cascade,
  google_email text not null,
  refresh_token_encrypted text not null,
  access_token text,
  access_token_expires_at timestamptz,
  oauth_redirect_uri text,
  history_id text,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists gmail_connections_user_id_idx on public.gmail_connections (user_id);

alter table public.gmail_connections enable row level security;

drop policy if exists "gmail_connections_select_own" on public.gmail_connections;
create policy "gmail_connections_select_own"
  on public.gmail_connections
  for select
  using (auth.uid() = user_id);

drop policy if exists "gmail_connections_insert_own" on public.gmail_connections;
create policy "gmail_connections_insert_own"
  on public.gmail_connections
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "gmail_connections_update_own" on public.gmail_connections;
create policy "gmail_connections_update_own"
  on public.gmail_connections
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "gmail_connections_delete_own" on public.gmail_connections;
create policy "gmail_connections_delete_own"
  on public.gmail_connections
  for delete
  using (auth.uid() = user_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists gmail_connections_set_updated_at on public.gmail_connections;
create trigger gmail_connections_set_updated_at
before update on public.gmail_connections
for each row
execute function public.set_updated_at();

notify pgrst, 'reload schema';
