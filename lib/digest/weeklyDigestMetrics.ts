import type { SupabaseClient } from "@supabase/supabase-js";

export type DigestDateRange = {
  weekStart: string;
  weekEnd: string;
  monthStart: string;
  monthLabel: string;
};

export type CategorySpendRow = {
  category: string;
  amount: number;
};

export type WeeklyDigestMetrics = {
  weeklyTotal: number;
  monthlyTotal: number;
  topCategory: string;
  weeklyTxCount: number;
  /** Posted spend this week, sorted by amount (high → low). */
  categoryBreakdown: CategorySpendRow[];
};

/** Current Sunday-Saturday calendar week in UTC date space. */
export function getDigestDateRange(now = new Date()): DigestDateRange {
  const weekStart = new Date(now);
  const weekEnd = new Date(now);
  const dow = now.getDay(); // Sun=0 ... Sat=6
  weekStart.setDate(now.getDate() - dow);
  weekEnd.setDate(weekStart.getDate() + 6);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  return {
    weekStart: weekStart.toISOString().slice(0, 10),
    weekEnd: weekEnd.toISOString().slice(0, 10),
    monthStart: monthStart.toISOString().slice(0, 10),
    monthLabel: now.toLocaleString("en-US", { month: "long", year: "numeric" }),
  };
}

export async function fetchWeeklyDigestMetrics(
  supabase: SupabaseClient,
  userId: string,
  range: DigestDateRange
): Promise<WeeklyDigestMetrics> {
  const { data: weeklyTx } = await supabase
    .from("transactions")
    .select("amount,category,date,status")
    .eq("user_id", userId)
    .eq("status", "posted")
    .gte("date", range.weekStart)
    .lte("date", range.weekEnd);

  const { data: monthlyTx } = await supabase
    .from("transactions")
    .select("amount,date,status")
    .eq("user_id", userId)
    .eq("status", "posted")
    .gte("date", range.monthStart)
    .lte("date", range.weekEnd);

  const weeklyTotal = (weeklyTx ?? []).reduce(
    (sum, tx) => sum + Number(tx.amount ?? 0),
    0
  );
  const monthlyTotal = (monthlyTx ?? []).reduce(
    (sum, tx) => sum + Number(tx.amount ?? 0),
    0
  );

  const categoryTotals = (weeklyTx ?? []).reduce<Record<string, number>>((acc, tx) => {
    const category = tx.category ?? "Other";
    acc[category] = (acc[category] ?? 0) + Number(tx.amount ?? 0);
    return acc;
  }, {});
  const categoryBreakdown: CategorySpendRow[] = Object.entries(categoryTotals)
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount || a.category.localeCompare(b.category));

  const topCategory = categoryBreakdown[0]?.category ?? "N/A";

  return {
    weeklyTotal,
    monthlyTotal,
    topCategory,
    weeklyTxCount: (weeklyTx ?? []).length,
    categoryBreakdown,
  };
}
