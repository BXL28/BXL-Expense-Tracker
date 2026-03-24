# BXL-Expense-Tracker

## Local setup

1. Copy `.env.example` to `.env.local`.
2. Fill Supabase, Google, Gemini, and cron secrets.
3. Run `npm install`.
4. Run `npm run dev`.
5. In **Supabase → SQL Editor**, run [`supabase/schema.sql`](supabase/schema.sql) (full schema), or at minimum these snippets if tables are missing or PostgREST can’t see them:
   - [`supabase/transactions_only.sql`](supabase/transactions_only.sql) — `public.transactions`
   - [`supabase/gmail_connections_only.sql`](supabase/gmail_connections_only.sql) — `public.gmail_connections`
   - [`supabase/profiles_only.sql`](supabase/profiles_only.sql) — `public.profiles` (monthly budget; fixes **Could not find the table `public.profiles` in the schema cache**).

If you already ran **partial** SQL (e.g. `transactions` missing `unique (user_id, hash_id)` or RLS), run [`supabase/patch_existing_tables.sql`](supabase/patch_existing_tables.sql) to align with the app. The app expects `gmail_connections.google_email` and `refresh_token_encrypted` (not `email` / raw `refresh_token`).

### Windows + OneDrive: `EINVAL` / `readlink` under `.next`

If `npm run dev` fails while deleting `.next` (often on paths under OneDrive), close **all** dev servers and terminals using the project, then:

```powershell
cd C:\Users\xieli\OneDrive\Desktop\ExpenseTracker
Remove-Item -Recurse -Force .next
npm run dev
```

Long-term, moving the repo to a **non-synced** folder (e.g. `C:\dev\ExpenseTracker`) avoids repeat cache corruption.

## Gmail connect flow

- Start OAuth for a signed-in app user:
  - `GET /api/google/connect?user_id=<supabase-user-uuid>`
- Google redirects to:
  - `GET /api/google/callback`
- Callback stores encrypted refresh token in `gmail_connections`.

## Cron endpoints

- Daily ingestion:
  - `GET /api/cron/daily-ingest`
- Weekly digest:
  - `GET /api/cron/weekly-digest`

Both routes require `x-cron-secret` header matching `CRON_SECRET`.

**Daily ingest schedule:** `vercel.json` runs at **21:00 UTC** (`0 21 * * *`), which is **4:00 PM Eastern Standard Time** and **5:00 PM Eastern Daylight Time** — i.e. after 4 PM for most of the year in Eastern Canada. Vercel crons are UTC-only; change the cron expression if you use a different timezone.

## How data gets into the dashboard

1. **Sign in** with Google (Supabase Auth) on `/login`.
2. **Connect Gmail** from the dashboard banner (or open `/api/google/connect?user_id=<your Auth UID>`). Use the **same Google account** that receives Scotia “Last five transactions” alerts.
3. Click **Sync from Gmail now** (calls `POST /api/sync/gmail` with your session token) or wait for **Vercel Cron** (`/api/cron/daily-ingest`).
4. The spreadsheet on `/dashboard` reads from the `transactions` table; edits and deletes write back to Supabase.
5. Users can set their own monthly budget directly on `/dashboard` (saved in `profiles.monthly_budget`).

`vercel.json` schedules daily ingest and a weekly digest email. After deploying, set the same env vars in Vercel and configure `CRON_SECRET` for secured cron requests.

## Debug Gmail parsing (no DB writes)

- On `/dashboard`, use **Gmail preview** (requires Gmail connected). It calls `GET /api/debug/gmail-preview` with your Supabase session token and returns:
  - the exact **Gmail search query** used,
  - each matching message’s **subject**, **snippet**, **body preview**, and **parsed transactions** (Gemini vs rules).

Or manually:

`GET /api/debug/gmail-preview?limit=5` with header `Authorization: Bearer <supabase_access_token>`.

## Test weekly digest email (manual)

On `/dashboard`: **Digest preview** (`GET /api/debug/weekly-digest`) builds the same email as the cron job without sending. **Send digest email** (`POST /api/debug/weekly-digest`) sends it once to your connected Gmail. Production cron still uses `GET /api/cron/weekly-digest` with header `x-cron-secret: <CRON_SECRET>`.