-- Run in Supabase SQL Editor if you created tables manually with different / partial definitions.
-- Safe to run multiple times (uses IF NOT EXISTS / drop-if-exists patterns where possible).

-- -----------------------------------------------------------------------------
-- profiles: required for dashboard monthly budget (create before ALTER below)
-- Or run supabase/profiles_only.sql alone.
-- -----------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  avatar_url text,
  monthly_budget numeric(12,2) not null default 700 check (monthly_budget >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
  on public.profiles for insert
  with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id) with check (auth.uid() = id);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new;
end $$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- transactions: add missing columns (if your CREATE stopped at posted_at only)
-- -----------------------------------------------------------------------------
alter table public.transactions add column if not exists parse_confidence numeric(5,4);
alter table public.transactions add column if not exists created_at timestamptz not null default now();
alter table public.transactions add column if not exists updated_at timestamptz not null default now();

create index if not exists transactions_user_id_idx on public.transactions (user_id);
create index if not exists transactions_date_idx on public.transactions (date desc);
create index if not exists transactions_user_id_date_idx on public.transactions (user_id, date desc);
create index if not exists transactions_source_email_id_idx on public.transactions (source_email_id);

alter table public.transactions drop constraint if exists transactions_hash_id_key;
alter table public.transactions drop constraint if exists transactions_user_hash_unique;
do $$
begin
  alter table public.transactions add constraint transactions_user_hash_unique unique (user_id, hash_id);
exception
  when duplicate_object then null;
end $$;

alter table public.transactions enable row level security;

drop policy if exists "transactions_select_own" on public.transactions;
create policy "transactions_select_own"
  on public.transactions for select using (auth.uid() = user_id);

drop policy if exists "transactions_insert_own" on public.transactions;
create policy "transactions_insert_own"
  on public.transactions for insert with check (auth.uid() = user_id);

drop policy if exists "transactions_update_own" on public.transactions;
create policy "transactions_update_own"
  on public.transactions for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "transactions_delete_own" on public.transactions;
create policy "transactions_delete_own"
  on public.transactions for delete using (auth.uid() = user_id);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new;
end $$;

drop trigger if exists transactions_set_updated_at on public.transactions;
create trigger transactions_set_updated_at
before update on public.transactions for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- profiles: add monthly budget setting for dashboard summary
-- -----------------------------------------------------------------------------
alter table public.profiles
  add column if not exists monthly_budget numeric(12,2) not null default 700 check (monthly_budget >= 0);

-- -----------------------------------------------------------------------------
-- gmail_connections: rename legacy columns to match the Next.js app (if present)
-- If a RENAME fails, skip that block — your table may already match.
-- -----------------------------------------------------------------------------
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'gmail_connections' and column_name = 'email'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'gmail_connections' and column_name = 'google_email'
  ) then
    alter table public.gmail_connections rename column email to google_email;
  end if;
exception
  when undefined_column then null;
end $$;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'gmail_connections' and column_name = 'refresh_token'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'gmail_connections' and column_name = 'refresh_token_encrypted'
  ) then
    alter table public.gmail_connections rename column refresh_token to refresh_token_encrypted;
  end if;
exception
  when undefined_column then null;
end $$;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'gmail_connections' and column_name = 'expires_at'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'gmail_connections' and column_name = 'access_token_expires_at'
  ) then
    alter table public.gmail_connections rename column expires_at to access_token_expires_at;
  end if;
exception
  when undefined_column then null;
end $$;

alter table public.gmail_connections add column if not exists oauth_redirect_uri text;
alter table public.gmail_connections add column if not exists history_id text;
alter table public.gmail_connections add column if not exists last_synced_at timestamptz;

notify pgrst, 'reload schema';
