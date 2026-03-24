-- BXL Expense Tracker multi-tenant schema (Supabase Postgres)

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  avatar_url text,
  monthly_budget numeric(12,2) not null default 700 check (monthly_budget >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.transactions (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  merchant text not null,
  amount numeric(12,2) not null check (amount >= 0),
  category text not null,
  hash_id text not null,
  source_email_id text,
  status text not null default 'posted' check (status in ('pending', 'posted')),
  posted_at date,
  parse_confidence numeric(5,4),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists transactions_user_id_idx on public.transactions (user_id);
create index if not exists transactions_date_idx on public.transactions (date desc);
create index if not exists transactions_user_id_date_idx on public.transactions (user_id, date desc);
create index if not exists transactions_source_email_id_idx on public.transactions (source_email_id);

alter table public.transactions drop constraint if exists transactions_hash_id_key;
alter table public.transactions drop constraint if exists transactions_user_hash_unique;
alter table public.transactions add constraint transactions_user_hash_unique unique (user_id, hash_id);

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

alter table public.gmail_connections
  add column if not exists oauth_redirect_uri text;

create index if not exists gmail_connections_user_id_idx on public.gmail_connections (user_id);

alter table public.profiles enable row level security;
alter table public.transactions enable row level security;
alter table public.gmail_connections enable row level security;

-- Profiles: users can only read and edit their own profile row.
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles
  for select
  using (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
  on public.profiles
  for insert
  with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles
  for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Transactions: users can only CRUD their own transactions.
drop policy if exists "transactions_select_own" on public.transactions;
create policy "transactions_select_own"
  on public.transactions
  for select
  using (auth.uid() = user_id);

drop policy if exists "transactions_insert_own" on public.transactions;
create policy "transactions_insert_own"
  on public.transactions
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "transactions_update_own" on public.transactions;
create policy "transactions_update_own"
  on public.transactions
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "transactions_delete_own" on public.transactions;
create policy "transactions_delete_own"
  on public.transactions
  for delete
  using (auth.uid() = user_id);

-- Gmail connections: users can only read and manage their own token row.
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

-- Keep updated_at fresh.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

drop trigger if exists transactions_set_updated_at on public.transactions;
create trigger transactions_set_updated_at
before update on public.transactions
for each row
execute function public.set_updated_at();

drop trigger if exists gmail_connections_set_updated_at on public.gmail_connections;
create trigger gmail_connections_set_updated_at
before update on public.gmail_connections
for each row
execute function public.set_updated_at();
