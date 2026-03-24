-- Run in Supabase → SQL Editor if you see:
-- "Could not find the table 'public.transactions' in the schema cache"

create extension if not exists pgcrypto;

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

alter table public.transactions enable row level security;

drop policy if exists "transactions_select_own" on public.transactions;
create policy "transactions_select_own"
  on public.transactions for select
  using (auth.uid() = user_id);

drop policy if exists "transactions_insert_own" on public.transactions;
create policy "transactions_insert_own"
  on public.transactions for insert
  with check (auth.uid() = user_id);

drop policy if exists "transactions_update_own" on public.transactions;
create policy "transactions_update_own"
  on public.transactions for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "transactions_delete_own" on public.transactions;
create policy "transactions_delete_own"
  on public.transactions for delete
  using (auth.uid() = user_id);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists transactions_set_updated_at on public.transactions;
create trigger transactions_set_updated_at
before update on public.transactions
for each row execute function public.set_updated_at();

notify pgrst, 'reload schema';
