"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Mail, Pencil, RefreshCw, ScanSearch, Send, Trash2 } from "lucide-react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import {
  getNextWeeklyDigestRunUtc,
  summarizeWeeklyDigestCron,
  WEEKLY_DIGEST_CRON_SCHEDULE,
} from "@/lib/digest/digestCronSchedule";

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

function toSelectCategory(c: string): Category {
  return CATEGORY_OPTIONS.includes(c as Category) ? (c as Category) : "Other";
}

export default function DashboardPage() {
  const router = useRouter();

  const supabase = useMemo(() => createBrowserSupabaseClient(), []);

  const [userId, setUserId] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [transactions, setTransactions] = useState<TxRow[]>([]);
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [gmailConnected, setGmailConnected] = useState<boolean | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [debugLoading, setDebugLoading] = useState(false);
  const [debugJson, setDebugJson] = useState<string | null>(null);
  const [debugTitle, setDebugTitle] = useState("Debug output");
  const [digestSending, setDigestSending] = useState(false);
  const [digestMessage, setDigestMessage] = useState<string | null>(null);
  const [digestScheduleTick, setDigestScheduleTick] = useState(0);
  const [monthlyBudget, setMonthlyBudget] = useState<number>(DEFAULT_MONTHLY_BUDGET);
  const [budgetInput, setBudgetInput] = useState<string>(String(DEFAULT_MONTHLY_BUDGET));
  const [savingBudget, setSavingBudget] = useState(false);

  const loadTransactions = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.user) return;

    const { data, error } = await supabase
      .from("transactions")
      .select("id,date,merchant,category,amount,status,source_email_id")
      .eq("user_id", session.user.id)
      .order("date", { ascending: false });

    if (error) {
      setLoadError(error.message);
      return;
    }

    setLoadError(null);
    setTransactions(
      (data ?? []).map((row) => ({
        id: String(row.id),
        date: row.date as string,
        merchant: row.merchant as string,
        category: row.category as string,
        amount: Number(row.amount),
        status: row.status as string,
        source_email_id: row.source_email_id as string | null,
      }))
    );
  }, [supabase]);

  const loadGmailStatus = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.user) return;

    const { data, error } = await supabase
      .from("gmail_connections")
      .select("last_synced_at")
      .eq("user_id", session.user.id)
      .maybeSingle();

    if (error) {
      setGmailConnected(false);
      return;
    }

    setGmailConnected(!!data);
    setLastSyncedAt(data?.last_synced_at ?? null);
  }, [supabase]);

  const loadMonthlyBudget = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.user) return;

    const { data, error } = await supabase
      .from("profiles")
      .select("monthly_budget")
      .eq("id", session.user.id)
      .maybeSingle();

    if (error) {
      setLoadError(error.message);
      return;
    }

    const value = Number(data?.monthly_budget);
    const nextBudget =
      Number.isFinite(value) && value >= 0 ? value : DEFAULT_MONTHLY_BUDGET;
    setMonthlyBudget(nextBudget);
    setBudgetInput(String(nextBudget));
  }, [supabase]);

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!mounted) return;

      if (!session?.user) {
        router.replace("/login");
        return;
      }

      setUserId(session.user.id);
      setAuthReady(true);
      await Promise.all([loadTransactions(), loadGmailStatus(), loadMonthlyBudget()]);
    };

    void init();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) {
        router.replace("/login");
        return;
      }
      setUserId(session.user.id);
      void loadTransactions();
      void loadGmailStatus();
      void loadMonthlyBudget();
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [supabase, router, loadTransactions, loadGmailStatus, loadMonthlyBudget]);

  const postedRows = useMemo(
    () => transactions.filter((tx) => tx.status === "posted"),
    [transactions]
  );

  useEffect(() => {
    const id = window.setInterval(() => setDigestScheduleTick((n) => n + 1), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const digestScheduleInfo = useMemo(() => {
    const now = new Date();
    const next = getNextWeeklyDigestRunUtc(WEEKLY_DIGEST_CRON_SCHEDULE, now);
    const summary = summarizeWeeklyDigestCron(WEEKLY_DIGEST_CRON_SCHEDULE);
    if (!next) {
      return {
        summary,
        ottawaWhen: null as string | null,
        utcTooltip: null as string | null,
      };
    }
    const ottawaWhen = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Toronto",
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    }).format(next);
    const utcTooltip = `Same instant: ${next.toISOString().replace("T", " ").slice(0, 16)} UTC (Vercel cron uses UTC)`;
    return {
      summary,
      ottawaWhen,
      utcTooltip,
    };
  }, [digestScheduleTick]);

  const summary = useMemo(() => {
    const totalSpent = postedRows.reduce((sum, tx) => sum + tx.amount, 0);

    const categorySpend = postedRows.reduce<Record<string, number>>((acc, tx) => {
      acc[tx.category] = (acc[tx.category] ?? 0) + tx.amount;
      return acc;
    }, {});

    const topCategory =
      Object.entries(categorySpend).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "N/A";
    const budgetPct =
      monthlyBudget > 0 ? Math.min((totalSpent / monthlyBudget) * 100, 100) : 0;

    return { totalSpent, topCategory, budgetPct };
  }, [postedRows, monthlyBudget]);

  const handleSaveBudget = async () => {
    const value = Number(budgetInput);
    if (!Number.isFinite(value) || value < 0) {
      setLoadError("Budget must be a number greater than or equal to 0.");
      return;
    }

    const rounded = Math.round(value * 100) / 100;

    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.user) return;

    setSavingBudget(true);
    setLoadError(null);

    const { error } = await supabase.from("profiles").upsert(
      {
        id: session.user.id,
        monthly_budget: rounded,
      },
      { onConflict: "id" }
    );

    setSavingBudget(false);
    if (error) {
      setLoadError(error.message);
      return;
    }

    setMonthlyBudget(rounded);
    setBudgetInput(String(rounded));
  };

  const handleSyncGmail = async () => {
    setSyncing(true);
    setSyncMessage(null);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setSyncMessage("Not signed in.");
        return;
      }

      const res = await fetch("/api/sync/gmail", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const json = (await res.json()) as {
        ok?: boolean;
        error?: string;
        inserted?: number;
        updated?: number;
        skipped?: number;
        upsertFailures?: number;
        emailsMatched?: number;
        parseErrors?: Array<{ user_id: string; message_id: string }>;
        fatalError?: string;
        hint?: string;
      };

      if (!res.ok) {
        setSyncMessage(json.error ?? json.hint ?? "Sync failed.");
        return;
      }

      if (json.fatalError) {
        setSyncMessage(
          `Sync failed: ${json.fatalError} (check server terminal / Gmail token & TOKEN_ENCRYPTION_KEY).`
        );
        return;
      }

      const pe = json.parseErrors?.length ?? 0;
      const uf = json.upsertFailures ?? 0;
      setSyncMessage(
        `Gmail: ${json.emailsMatched ?? 0} credit card alert(s) processed (day-to-day Scotia emails ignored). ` +
          `+${json.inserted ?? 0} new, ${json.updated ?? 0} updated, ${json.skipped ?? 0} skipped (dedupe). ` +
          (pe ? `${pe} parse issue(s). ` : "") +
          (uf ? `${uf} DB write error(s).` : "")
      );
      await loadTransactions();
      await loadGmailStatus();
    } catch {
      setSyncMessage("Sync request failed.");
    } finally {
      setSyncing(false);
    }
  };

  const handleGmailDebugPreview = async () => {
    setDebugLoading(true);
    setDebugTitle("Gmail ingest preview (debug)");
    setDebugJson(null);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setDebugJson(JSON.stringify({ error: "No session access_token" }, null, 2));
        return;
      }
      const res = await fetch("/api/debug/gmail-preview?limit=8", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const json = await res.json();
      setDebugJson(JSON.stringify(json, null, 2));
    } catch (e) {
      setDebugJson(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }, null, 2));
    } finally {
      setDebugLoading(false);
    }
  };

  const handleWeeklyDigestPreview = async () => {
    setDebugLoading(true);
    setDebugTitle("Weekly digest — preview (no email sent)");
    setDebugJson(null);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setDebugJson(JSON.stringify({ error: "No session access_token" }, null, 2));
        return;
      }
      const res = await fetch("/api/debug/weekly-digest", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const json = await res.json();
      setDebugJson(JSON.stringify(json, null, 2));
    } catch (e) {
      setDebugJson(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }, null, 2));
    } finally {
      setDebugLoading(false);
    }
  };

  const handleWeeklyDigestSend = async () => {
    setDigestSending(true);
    setDigestMessage(null);
    setLoadError(null);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setLoadError("Not signed in.");
        return;
      }
      const res = await fetch("/api/debug/weekly-digest", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const json = (await res.json()) as {
        ok?: boolean;
        error?: string;
        detail?: string;
        sentTo?: string;
      };
      if (!res.ok) {
        setLoadError(
          json.detail ? `${json.error ?? "Request failed"}: ${json.detail}` : json.error ?? "Request failed."
        );
        return;
      }
      setDigestMessage(`Weekly digest email sent to ${json.sentTo ?? "your Gmail"}.`);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Send failed.");
    } finally {
      setDigestSending(false);
    }
  };

  const handleCategoryChange = async (id: string, category: Category) => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.user) return;

    const { error } = await supabase
      .from("transactions")
      .update({ category })
      .eq("id", id)
      .eq("user_id", session.user.id);

    if (error) {
      setLoadError(error.message);
      return;
    }

    setTransactions((prev) =>
      prev.map((tx) => (tx.id === id ? { ...tx, category } : tx))
    );
  };

  const handleDelete = async (id: string) => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.user) return;

    const { error } = await supabase
      .from("transactions")
      .delete()
      .eq("id", id)
      .eq("user_id", session.user.id);

    if (error) {
      setLoadError(error.message);
      return;
    }

    setTransactions((prev) => prev.filter((tx) => tx.id !== id));
  };

  if (!authReady) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-600">
        Loading…
      </main>
    );
  }

  const connectHref =
    typeof window !== "undefined" && userId
      ? `${window.location.origin}/api/google/connect?user_id=${userId}`
      : "";

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Dashboard</h1>
            <p className="mt-1 text-sm text-slate-600">
              Live data from Supabase. Incoming mail is parsed after you connect Gmail once.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void handleSyncGmail()}
              disabled={syncing || !gmailConnected}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "Syncing…" : "Sync from Gmail now"}
            </button>
            <button
              type="button"
              onClick={() => void handleGmailDebugPreview()}
              disabled={debugLoading || !gmailConnected}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ScanSearch className="h-4 w-4" />
              {debugLoading ? "Loading…" : "Gmail preview"}
            </button>
            <button
              type="button"
              onClick={() => void handleWeeklyDigestPreview()}
              disabled={debugLoading || !gmailConnected}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Mail className="h-4 w-4" />
              Digest preview
            </button>
            <button
              type="button"
              onClick={() => void handleWeeklyDigestSend()}
              disabled={digestSending || !gmailConnected}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
              {digestSending ? "Sending…" : "Send digest email"}
            </button>
            <Link
              href="/login"
              className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              Account
            </Link>
          </div>
        </div>

        {gmailConnected === false && (
          <div className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-2 text-sm text-amber-900">
              <Mail className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-medium">Connect Gmail for Scotia alerts</p>
                <p className="mt-1 text-amber-800/90">
                  Signing in with Google only logs you into BXL. Grant Gmail access with the same
                  Google account that receives &quot;Last five transactions&quot; emails.
                </p>
              </div>
            </div>
            {connectHref ? (
              <a
                href={connectHref}
                className="shrink-0 rounded-xl bg-amber-900 px-4 py-2 text-center text-sm font-medium text-white hover:bg-amber-950"
              >
                Connect Gmail
              </a>
            ) : null}
          </div>
        )}

        <div className="space-y-1 text-xs text-slate-500">
          {gmailConnected && lastSyncedAt ? (
            <p>Last Gmail sync: {new Date(lastSyncedAt).toLocaleString()}</p>
          ) : null}
          <p title={digestScheduleInfo.utcTooltip ?? undefined}>
            <span className="font-medium text-slate-600">Next digest email:</span>{" "}
            {digestScheduleInfo.ottawaWhen
              ? `${digestScheduleInfo.ottawaWhen} (Ottawa)`
              : "Estimate unavailable — verify cron in vercel.json."}{" "}
            <span className="text-slate-400" title={WEEKLY_DIGEST_CRON_SCHEDULE}>
              · {digestScheduleInfo.summary}
            </span>
          </p>
          {gmailConnected === false ? (
            <p className="text-amber-800/90">Connect Gmail to receive digest emails.</p>
          ) : null}
        </div>

        {syncMessage ? (
          <p className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
            {syncMessage}
          </p>
        ) : null}

        {digestMessage ? (
          <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
            {digestMessage}
          </p>
        ) : null}

        {debugJson ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-900 p-4 text-slate-100 shadow-sm">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{debugTitle}</p>
              <button
                type="button"
                onClick={() => setDebugJson(null)}
                className="text-xs text-slate-400 hover:text-white"
              >
                Dismiss
              </button>
            </div>
            <pre className="max-h-[28rem] overflow-auto whitespace-pre-wrap break-all text-xs leading-relaxed">
              {debugJson}
            </pre>
          </div>
        ) : null}

        {loadError ? (
          <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
            {loadError}
          </p>
        ) : null}

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <h2 className="text-xl font-semibold tracking-tight">Monthly summary</h2>
          <p className="mt-1 text-xs text-slate-500">
            Totals use <strong>posted</strong> charges only (pending excluded from the headline).
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <SummaryCard label="Total spent (posted)" value={`$${summary.totalSpent.toFixed(2)}`} />
            <SummaryCard label="Top category" value={summary.topCategory} />
            <SummaryCard label="Budget goal" value={`${summary.budgetPct.toFixed(0)}% used`} />
          </div>

          <div className="mt-4">
            <div className="h-2 w-full rounded-full bg-slate-200">
              <div
                className="h-2 rounded-full bg-slate-900 transition-all"
                style={{ width: `${summary.budgetPct}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-slate-600">
              Budget: ${monthlyBudget.toFixed(2)}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <label htmlFor="monthly-budget" className="text-xs text-slate-600">
                Monthly budget
              </label>
              <input
                id="monthly-budget"
                type="number"
                min="0"
                step="0.01"
                value={budgetInput}
                onChange={(event) => setBudgetInput(event.target.value)}
                className="w-36 rounded-lg border border-slate-300 bg-white px-2 py-1 text-sm text-slate-800"
              />
              <button
                type="button"
                onClick={() => void handleSaveBudget()}
                disabled={savingBudget}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {savingBudget ? "Saving..." : "Save budget"}
              </button>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <h2 className="text-xl font-semibold tracking-tight">Transactions</h2>
          <p className="mt-1 text-sm text-slate-600">
            From Scotia alert emails after sync. Edit category or delete a row (updates Supabase).
          </p>

          {transactions.length === 0 ? (
            <p className="mt-6 text-sm text-slate-500">
              No transactions yet. Connect Gmail, then use &quot;Sync from Gmail now&quot;.
            </p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full border-separate border-spacing-y-2 text-sm">
                <thead>
                  <tr className="text-left text-slate-500">
                    <th className="px-3 py-2 font-medium">Date</th>
                    <th className="px-3 py-2 font-medium">Merchant</th>
                    <th className="px-3 py-2 font-medium">Category</th>
                    <th className="px-3 py-2 font-medium">Amount</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((tx) => {
                    const isEditing = editingRowId === tx.id;
                    const selectValue = toSelectCategory(tx.category);

                    return (
                      <tr key={tx.id} className="rounded-xl bg-slate-100/70 text-slate-800">
                        <td className="whitespace-nowrap px-3 py-3">{tx.date}</td>
                        <td className="whitespace-nowrap px-3 py-3">{tx.merchant}</td>
                        <td className="px-3 py-3">
                          {isEditing ? (
                            <select
                              value={selectValue}
                              onChange={(event) =>
                                void handleCategoryChange(tx.id, event.target.value as Category)
                              }
                              className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1"
                            >
                              {CATEGORY_OPTIONS.map((option) => (
                                <option key={option} value={option}>
                                  {option}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <span>{tx.category}</span>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3">${tx.amount.toFixed(2)}</td>
                        <td className="whitespace-nowrap px-3 py-3 text-xs uppercase text-slate-500">
                          {tx.status}
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                setEditingRowId((prev) => (prev === tx.id ? null : tx.id))
                              }
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
          )}
        </section>
      </div>
    </main>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-slate-900">{value}</p>
    </div>
  );
}
