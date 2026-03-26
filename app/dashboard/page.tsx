"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronUp, Mail, Pencil, RefreshCw, Send, Trash2 } from "lucide-react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { BrandMark } from "@/components/BrandMark";
import {
  summarizeWeeklyDigestCron,
  WEEKLY_DIGEST_CRON_SCHEDULE,
} from "@/lib/digest/digestCronSchedule";
import {
  DEFAULT_DIGEST_PREFS,
  getNextDigestWindowStart,
  normalizeDigestPrefs,
} from "@/lib/digest/userDigestSlot";

type Category =
  | "Food"
  | "Transport"
  | "Shopping"
  | "Utilities"
  | "Health"
  | "Other";

const CATEGORY_OPTIONS: Category[] = [
  "Food",
  "Transport",
  "Shopping",
  "Utilities",
  "Health",
  "Other",
];

type TxRow = {
  id: string;
  date: string;
  merchant: string;
  category: string;
  amount: number;
  status: string;
  source_email_id: string | null;
};

const DEFAULT_MONTHLY_BUDGET = 700;

const DIGEST_DAY_OPTIONS: { value: number; label: string }[] = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
];

const DIGEST_MINUTE_OPTIONS: readonly number[] = Array.from({ length: 60 }, (_, i) => i);

function toSelectCategory(c: string): Category {
  return CATEGORY_OPTIONS.includes(c as Category) ? (c as Category) : "Other";
}

/** "2026-03" → "March 2026" */
function formatMonthLabel(key: string): string {
  const [y, m] = key.split("-");
  const d = new Date(Number(y), Number(m) - 1, 1);
  return d.toLocaleString("en-CA", { month: "long", year: "numeric" });
}

export default function DashboardPage() {
  const router = useRouter();
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);

  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [transactions, setTransactions] = useState<TxRow[]>([]);
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [gmailConnected, setGmailConnected] = useState<boolean | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [digestScheduleTick, setDigestScheduleTick] = useState(0);
  const [monthlyBudget, setMonthlyBudget] = useState<number>(DEFAULT_MONTHLY_BUDGET);
  const [budgetInput, setBudgetInput] = useState<string>(String(DEFAULT_MONTHLY_BUDGET));
  const [savingBudget, setSavingBudget] = useState(false);
  const [digestWeekday, setDigestWeekday] = useState(DEFAULT_DIGEST_PREFS.digestWeekday);
  const [digestHour, setDigestHour] = useState(DEFAULT_DIGEST_PREFS.digestHour);
  const [digestMinute, setDigestMinute] = useState(DEFAULT_DIGEST_PREFS.digestMinute);
  const [savingDigestSchedule, setSavingDigestSchedule] = useState(false);
  const [digestSending, setDigestSending] = useState(false);
  const [digestMessage, setDigestMessage] = useState<string | null>(null);
  // which month accordions are open (key = "YYYY-MM"); default: most recent open
  const [openMonths, setOpenMonths] = useState<Set<string>>(new Set());

  const loadTransactions = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;

    const { data, error } = await supabase
      .from("transactions")
      .select("id,date,merchant,category,amount,status,source_email_id")
      .eq("user_id", session.user.id)
      .order("date", { ascending: false });

    if (error) { setLoadError(error.message); return; }

    const rows = (data ?? []).map((row) => ({
      id: String(row.id),
      date: row.date as string,
      merchant: row.merchant as string,
      category: row.category as string,
      amount: Number(row.amount),
      status: row.status as string,
      source_email_id: row.source_email_id as string | null,
    }));

    setLoadError(null);
    setTransactions(rows);

    // auto-open the most recent month
    if (rows.length > 0) {
      const first = rows[0].date.slice(0, 7);
      setOpenMonths((prev) => {
        if (prev.size === 0) return new Set([first]);
        return prev;
      });
    }
  }, [supabase]);

  const loadGmailStatus = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;
    const { data, error } = await supabase
      .from("gmail_connections")
      .select("last_synced_at")
      .eq("user_id", session.user.id)
      .maybeSingle();
    if (error) { setGmailConnected(false); return; }
    setGmailConnected(!!data);
    setLastSyncedAt(data?.last_synced_at ?? null);
  }, [supabase]);

  const loadMonthlyBudget = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;
    const { data, error } = await supabase
      .from("profiles")
      .select("monthly_budget, digest_weekday, digest_hour, digest_minute, digest_timezone")
      .eq("id", session.user.id)
      .maybeSingle();
    if (error) { setLoadError(error.message); return; }
    const value = Number(data?.monthly_budget);
    const nextBudget = Number.isFinite(value) && value >= 0 ? value : DEFAULT_MONTHLY_BUDGET;
    setMonthlyBudget(nextBudget);
    setBudgetInput(String(nextBudget));
    const dPrefs = normalizeDigestPrefs({
      digestWeekday: data?.digest_weekday as number | undefined,
      digestHour: data?.digest_hour as number | undefined,
      digestMinute: data?.digest_minute as number | undefined,
      digestTimezone: (data?.digest_timezone as string | undefined) ?? undefined,
    });
    setDigestWeekday(dPrefs.digestWeekday);
    setDigestHour(dPrefs.digestHour);
    setDigestMinute(dPrefs.digestMinute);
  }, [supabase]);

  useEffect(() => {
    let mounted = true;
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!mounted) return;
      if (!session?.user) { router.replace("/login"); return; }
      setUserId(session.user.id);
      setUserEmail(session.user.email ?? null);
      setAuthReady(true);
      await Promise.all([loadTransactions(), loadGmailStatus(), loadMonthlyBudget()]);
    };
    void init();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) { router.replace("/login"); return; }
      setUserId(session.user.id);
      setUserEmail(session.user.email ?? null);
      void loadTransactions();
      void loadGmailStatus();
      void loadMonthlyBudget();
    });
    return () => { mounted = false; subscription.unsubscribe(); };
  }, [supabase, router, loadTransactions, loadGmailStatus, loadMonthlyBudget]);

  useEffect(() => {
    if (!authReady || !userId || gmailConnected !== false) return;
    if (typeof window === "undefined") return;
    if (sessionStorage.getItem("gmail_connect_attempted") === "1") return;
    sessionStorage.setItem("gmail_connect_attempted", "1");
    const params = new URLSearchParams({ user_id: userId });
    if (userEmail) params.set("login_hint", userEmail);
    window.location.assign(`${window.location.origin}/api/google/connect?${params.toString()}`);
  }, [authReady, userId, userEmail, gmailConnected]);

  useEffect(() => {
    if (gmailConnected) sessionStorage.removeItem("gmail_connect_attempted");
  }, [gmailConnected]);

  useEffect(() => {
    const id = window.setInterval(() => setDigestScheduleTick((n) => n + 1), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const digestScheduleInfo = useMemo(() => {
    void digestScheduleTick;
    const now = new Date();
    const prefs = normalizeDigestPrefs({ digestWeekday, digestHour, digestMinute, digestTimezone: DEFAULT_DIGEST_PREFS.digestTimezone });
    const next = getNextDigestWindowStart(now, prefs, WEEKLY_DIGEST_CRON_SCHEDULE);
    const summary = summarizeWeeklyDigestCron(WEEKLY_DIGEST_CRON_SCHEDULE);
    if (!next) return { summary, localWhen: null as string | null, utcTooltip: null as string | null };
    const localWhen = new Intl.DateTimeFormat("en-CA", { timeZone: prefs.digestTimezone, weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" }).format(next);
    const utcTooltip = `Same instant: ${next.toISOString().replace("T", " ").slice(0, 16)} UTC`;
    return { summary, localWhen, utcTooltip };
  }, [digestScheduleTick, digestWeekday, digestHour, digestMinute]);

  const postedRows = useMemo(() => transactions.filter((tx) => tx.status === "posted"), [transactions]);

  const currentMonthKey = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  }, []);

  const summary = useMemo(() => {
    const currentRows = postedRows.filter((tx) => tx.date.startsWith(currentMonthKey));
    const totalSpent = currentRows.reduce((sum, tx) => sum + tx.amount, 0);
    const categorySpend = currentRows.reduce<Record<string, number>>((acc, tx) => {
      acc[tx.category] = (acc[tx.category] ?? 0) + tx.amount;
      return acc;
    }, {});
    const topCategory = Object.entries(categorySpend).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "N/A";
    const budgetPct = monthlyBudget > 0 ? Math.min((totalSpent / monthlyBudget) * 100, 100) : 0;
    return { totalSpent, topCategory, budgetPct };
  }, [postedRows, monthlyBudget, currentMonthKey]);

  // Group ALL transactions by "YYYY-MM", sorted newest first
  const monthGroups = useMemo(() => {
    const map = new Map<string, TxRow[]>();
    for (const tx of transactions) {
      const key = tx.date.slice(0, 7);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(tx);
    }
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [transactions]);

  const toggleMonth = (key: string) => {
    setOpenMonths((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleSaveBudget = async () => {
    const value = Number(budgetInput);
    if (!Number.isFinite(value) || value < 0) { setLoadError("Budget must be ≥ 0."); return; }
    const rounded = Math.round(value * 100) / 100;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;
    setSavingBudget(true);
    setLoadError(null);
    const { error } = await supabase.from("profiles").upsert({ id: session.user.id, monthly_budget: rounded }, { onConflict: "id" });
    setSavingBudget(false);
    if (error) { setLoadError(error.message); return; }
    setMonthlyBudget(rounded);
    setBudgetInput(String(rounded));
  };

  const handleSaveDigestSchedule = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;
    const normalized = normalizeDigestPrefs({ digestWeekday, digestHour, digestMinute, digestTimezone: DEFAULT_DIGEST_PREFS.digestTimezone });
    setSavingDigestSchedule(true);
    setLoadError(null);
    const { error } = await supabase.from("profiles").upsert({ id: session.user.id, digest_weekday: normalized.digestWeekday, digest_hour: normalized.digestHour, digest_minute: normalized.digestMinute, digest_timezone: normalized.digestTimezone }, { onConflict: "id" });
    setSavingDigestSchedule(false);
    if (error) { setLoadError(error.message); return; }
    setDigestWeekday(normalized.digestWeekday);
    setDigestHour(normalized.digestHour);
    setDigestMinute(normalized.digestMinute);
  };

  const handleWeeklyDigestSend = async () => {
    setDigestSending(true);
    setDigestMessage(null);
    setLoadError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) { setLoadError("Not signed in."); return; }
      const res = await fetch("/api/debug/weekly-digest", { method: "POST", headers: { Authorization: `Bearer ${session.access_token}` } });
      const json = (await res.json()) as { ok?: boolean; error?: string; detail?: string; sentTo?: string };
      if (!res.ok) { setLoadError(json.detail ? `${json.error ?? "Request failed"}: ${json.detail}` : json.error ?? "Request failed."); return; }
      setDigestMessage(`Weekly digest sent to ${json.sentTo ?? "your Gmail"}.`);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Send failed.");
    } finally {
      setDigestSending(false);
    }
  };

  const handleSyncGmail = async () => {
    setSyncing(true);
    setSyncMessage(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) { setSyncMessage("Not signed in."); return; }
      const res = await fetch("/api/sync/gmail", { method: "POST", headers: { Authorization: `Bearer ${session.access_token}` } });
      const json = (await res.json()) as { ok?: boolean; error?: string; inserted?: number; updated?: number; skipped?: number; upsertFailures?: number; emailsMatched?: number; parseErrors?: Array<{ user_id: string; message_id: string }>; fatalError?: string; hint?: string };
      if (!res.ok) { setSyncMessage(json.error ?? json.hint ?? "Sync failed."); return; }
      if (json.fatalError) { setSyncMessage(`Sync failed: ${json.fatalError}`); return; }
      const pe = json.parseErrors?.length ?? 0;
      const uf = json.upsertFailures ?? 0;
      setSyncMessage(
        `Gmail: ${json.emailsMatched ?? 0} credit card alert(s) processed. +${json.inserted ?? 0} new, ${json.updated ?? 0} updated, ${json.skipped ?? 0} skipped.` +
        (pe ? ` ${pe} parse issue(s).` : "") + (uf ? ` ${uf} DB error(s).` : "")
      );
      await loadTransactions();
      await loadGmailStatus();
    } catch { setSyncMessage("Sync request failed."); }
    finally { setSyncing(false); }
  };

  const handleCategoryChange = async (id: string, category: Category) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;
    const { error } = await supabase.from("transactions").update({ category }).eq("id", id).eq("user_id", session.user.id);
    if (error) { setLoadError(error.message); return; }
    setTransactions((prev) => prev.map((tx) => (tx.id === id ? { ...tx, category } : tx)));
  };

  const handleDelete = async (id: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;
    const { error } = await supabase.from("transactions").delete().eq("id", id).eq("user_id", session.user.id);
    if (error) { setLoadError(error.message); return; }
    setTransactions((prev) => prev.filter((tx) => tx.id !== id));
  };

  if (!authReady) {
    return <main className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-600">Loading…</main>;
  }

  const connectHref =
    typeof window !== "undefined" && userId
      ? `${window.location.origin}/api/google/connect?user_id=${encodeURIComponent(userId)}${userEmail ? `&login_hint=${encodeURIComponent(userEmail)}` : ""}`
      : "";

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-6xl space-y-6">

        {/* ── Header ── */}
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div className="flex items-start gap-3">
            <BrandMark heightClass="h-12 sm:h-14" className="shrink-0" />
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Dashboard</h1>
              <p className="mt-1 text-sm text-slate-600">Synced from Gmail. Edit categories or delete rows.</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void handleSyncGmail()}
              disabled={syncing || !gmailConnected}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "Syncing…" : "Sync from Gmail"}
            </button>
            <button
              type="button"
              onClick={() => void handleWeeklyDigestSend()}
              disabled={digestSending || !gmailConnected}
              className="inline-flex items-center gap-2 rounded-xl border border-bxl-moss bg-bxl-forest px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-bxl-moss disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
              {digestSending ? "Sending…" : "Send digest email"}
            </button>
            <Link href="/login" className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">
              Account
            </Link>
          </div>
        </div>

        {/* ── Gmail connect banner ── */}
        {gmailConnected === false && (
          <div className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-2 text-sm text-amber-900">
              <Mail className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-medium">Connect Gmail for Scotia alerts</p>
                <p className="mt-1 text-amber-800/90">Grant Gmail access with the account that receives &quot;Last five transactions&quot; emails.</p>
              </div>
            </div>
            {connectHref ? (
              <a href={connectHref} className="shrink-0 rounded-xl bg-bxl-forest px-4 py-2 text-center text-sm font-medium text-white shadow-sm hover:bg-bxl-moss">Connect Gmail</a>
            ) : null}
          </div>
        )}

        {/* ── Status line ── */}
        <div className="space-y-1 text-xs text-slate-500">
          {gmailConnected && lastSyncedAt ? <p>Last Gmail sync: {new Date(lastSyncedAt).toLocaleString()}</p> : null}
          <p title={digestScheduleInfo.utcTooltip ?? undefined}>
            <span className="font-medium text-slate-600">Next digest:</span>{" "}
            {digestScheduleInfo.localWhen ? `${digestScheduleInfo.localWhen} (Eastern)` : "—"}{" "}
            <span className="text-slate-400">· {digestScheduleInfo.summary}</span>
          </p>
        </div>

        {syncMessage ? <p className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">{syncMessage}</p> : null}
        {digestMessage ? <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">{digestMessage}</p> : null}
        {loadError ? <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{loadError}</p> : null}

        {/* ── Monthly summary ── */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <h2 className="text-xl font-semibold tracking-tight">Monthly summary</h2>
          <p className="mt-1 text-xs text-slate-500">Posted charges only for {formatMonthLabel(currentMonthKey)}.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <SummaryCard label="Total spent (posted)" value={`$${summary.totalSpent.toFixed(2)}`} />
            <SummaryCard label="Top category" value={summary.topCategory} />
            <SummaryCard label="Budget goal" value={`${summary.budgetPct.toFixed(0)}% used`} />
          </div>
          <div className="mt-4">
            <div className="h-2 w-full rounded-full bg-slate-200">
              <div className="h-2 rounded-full bg-gradient-to-r from-bxl-moss to-bxl-accent transition-all" style={{ width: `${summary.budgetPct}%` }} />
            </div>
            <p className="mt-2 text-xs text-slate-600">Budget: ${monthlyBudget.toFixed(2)}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <label htmlFor="monthly-budget" className="text-xs text-slate-600">Monthly budget</label>
              <input id="monthly-budget" type="number" min="0" step="0.01" value={budgetInput} onChange={(e) => setBudgetInput(e.target.value)} className="w-36 rounded-lg border border-slate-300 bg-white px-2 py-1 text-sm text-slate-800" />
              <button type="button" onClick={() => void handleSaveBudget()} disabled={savingBudget} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50">
                {savingBudget ? "Saving..." : "Save budget"}
              </button>
            </div>
          </div>

          {/* ── Digest schedule ── */}
          <div className="mt-6 border-t border-slate-200 pt-4">
            <h3 className="text-sm font-semibold text-slate-900">Weekly digest email</h3>
            <p className="mt-1 text-xs text-slate-500">
              Runs <strong>once per day</strong> ({digestScheduleInfo.summary}). Sends on your chosen weekday in America/Toronto.
            </p>
            <div className="mt-3 flex flex-wrap items-end gap-3">
              <label className="flex flex-col gap-1 text-xs text-slate-600">
                Day
                <select value={digestWeekday} onChange={(e) => setDigestWeekday(Number(e.target.value))} className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-800">
                  {DIGEST_DAY_OPTIONS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs text-slate-600">
                Hour (0–23)
                <select value={digestHour} onChange={(e) => setDigestHour(Number(e.target.value))} className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-800">
                  {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{String(h).padStart(2, "0")}</option>)}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs text-slate-600">
                Minute
                <select value={digestMinute} onChange={(e) => setDigestMinute(Number(e.target.value))} className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-800">
                  {DIGEST_MINUTE_OPTIONS.map((m) => <option key={m} value={m}>:{String(m).padStart(2, "0")}</option>)}
                </select>
              </label>
              <button type="button" onClick={() => void handleSaveDigestSchedule()} disabled={savingDigestSchedule} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50">
                {savingDigestSchedule ? "Saving..." : "Save digest schedule"}
              </button>
            </div>
          </div>
        </section>

        {/* ── Transactions by month ── */}
        <section className="space-y-3">
          <h2 className="text-xl font-semibold tracking-tight text-slate-900">Transactions</h2>
          {monthGroups.length === 0 ? (
            <p className="text-sm text-slate-500">No transactions yet. Connect Gmail and sync.</p>
          ) : (
            monthGroups.map(([monthKey, rows]) => {
              const posted = rows.filter((tx) => tx.status === "posted");
              const total = posted.reduce((s, tx) => s + tx.amount, 0);
              const overBudget = total > monthlyBudget;
              const isOpen = openMonths.has(monthKey);

              return (
                <div key={monthKey} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <button
                    type="button"
                    onClick={() => toggleMonth(monthKey)}
                    className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left hover:bg-slate-50"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-semibold text-slate-900">{formatMonthLabel(monthKey)}</span>
                      <span className="text-xs text-slate-500">{rows.length} transaction{rows.length !== 1 ? "s" : ""}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      {!isOpen && (
                        <div className="flex items-center gap-2 text-xs">
                          <span className="font-medium text-slate-700">${total.toFixed(2)}</span>
                          <span className={`rounded-full px-2 py-0.5 font-medium ${overBudget ? "bg-rose-100 text-rose-700" : "bg-bxl-lime/40 text-bxl-forest"}`}>
                            {overBudget ? `$${(total - monthlyBudget).toFixed(2)} over` : "Within budget"}
                          </span>
                        </div>
                      )}
                      {isOpen ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
                    </div>
                  </button>

                  {isOpen && (
                    <div className="border-t border-slate-100 px-5 pb-4 pt-2">
                      <div className="mb-3 flex items-center gap-3 text-xs text-slate-500">
                        <span>Total posted: <strong className="text-slate-700">${total.toFixed(2)}</strong></span>
                        <span className={`rounded-full px-2 py-0.5 font-medium ${overBudget ? "bg-rose-100 text-rose-700" : "bg-bxl-lime/40 text-bxl-forest"}`}>
                          {overBudget ? `$${(total - monthlyBudget).toFixed(2)} over budget` : "Within budget"}
                        </span>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="min-w-full border-separate border-spacing-y-1.5 text-sm">
                          <thead>
                            <tr className="text-left text-slate-500">
                              <th className="px-3 py-1 font-medium">Date</th>
                              <th className="px-3 py-1 font-medium">Merchant</th>
                              <th className="px-3 py-1 font-medium">Category</th>
                              <th className="px-3 py-1 font-medium">Amount</th>
                              <th className="px-3 py-1 font-medium">Status</th>
                              <th className="px-3 py-1 font-medium">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {rows.map((tx) => {
                              const isEditing = editingRowId === tx.id;
                              return (
                                <tr key={tx.id} className="rounded-xl bg-slate-100/70 text-slate-800">
                                  <td className="whitespace-nowrap px-3 py-2.5">{tx.date}</td>
                                  <td className="whitespace-nowrap px-3 py-2.5">{tx.merchant}</td>
                                  <td className="px-3 py-2.5">
                                    {isEditing ? (
                                      <select
                                        value={toSelectCategory(tx.category)}
                                        onChange={(e) => void handleCategoryChange(tx.id, e.target.value as Category)}
                                        className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1"
                                      >
                                        {CATEGORY_OPTIONS.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                                      </select>
                                    ) : <span>{tx.category}</span>}
                                  </td>
                                  <td className="whitespace-nowrap px-3 py-2.5">${tx.amount.toFixed(2)}</td>
                                  <td className="whitespace-nowrap px-3 py-2.5 text-xs uppercase text-slate-500">{tx.status}</td>
                                  <td className="px-3 py-2.5">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <button
                                        type="button"
                                        onClick={() => setEditingRowId((prev) => (prev === tx.id ? null : tx.id))}
                                        className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs hover:bg-slate-50"
                                      >
                                        <Pencil className="h-3.5 w-3.5" />
                                        {isEditing ? "Done" : "Edit"}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => void handleDelete(tx.id)}
                                        className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2 py-1 text-xs text-rose-700 hover:bg-rose-100"
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                        Delete
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </section>
      </div>
    </main>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 border-l-2 border-l-bxl-moss bg-slate-50 p-3">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-slate-900">{value}</p>
    </div>
  );
}
