-- Run in Supabase → SQL Editor (same project as NEXT_PUBLIC_SUPABASE_URL).
-- Fixes: "column profiles.digest_weekday does not exist"
--
-- Use plain ALTERs (not inside DO $$) so Postgres always applies them.

alter table public.profiles add column if not exists digest_weekday smallint not null default 0;
alter table public.profiles add column if not exists digest_hour smallint not null default 9;
alter table public.profiles add column if not exists digest_minute smallint not null default 0;
alter table public.profiles add column if not exists digest_timezone text not null default 'America/Toronto';

alter table public.gmail_connections add column if not exists weekly_digest_last_calendar_date text;

notify pgrst, 'reload schema';
