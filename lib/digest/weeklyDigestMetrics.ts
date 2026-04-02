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

export type WeekOfMonthRow = {
  weekLabel: string;
  weekStart: string;
  weekEnd: string;
  total: number;
  categoryBreakdown: CategorySpendRow[];
  isCurrent: boolean;
};

export type WeeklyDigestMetrics = {
  weeklyTotal: number;
  monthlyTotal: number;
  topCategory: string;
  weeklyTxCount: number;
  /** Posted spend this week, sorted by amount (high → low). */
  categoryBreakdown: CategorySpendRow[];
  /** Per-week totals and category breakdown for all elapsed weeks in the month. */
  weeksOfMonth: WeekOfMonthRow[];
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

/**
 * Returns all Sun–Sat week windows that overlap with the month in the given range,
 * with display dates clamped to month boundaries.
 */
function getWeekWindowsForMonth(range: DigestDateRange): Array<{
  actualStart: string;
  actualEnd: string;
  displayStart: string;
  displayEnd: string;
}> {
  const [y, m] = range.monthStart.split("-").map(Number);
  const monthStart = new Date(y, m - 1, 1);
  const monthEnd = new Date(y, m, 0); // last day of month

  // First Sunday on or before monthStart
  const cursor = new Date(monthStart);
  cursor.setDate(monthStart.getDate() - monthStart.getDay());

  const windows: Array<{
    actualStart: string;
    actualEnd: string;
    displayStart: string;
    displayEnd: string;
  }> = [];

  while (cursor <= monthEnd) {
    const weekSun = new Date(cursor);
    const weekSat = new Date(cursor);
    weekSat.setDate(cursor.getDate() + 6);

    const displayStart = weekSun < monthStart ? new Date(monthStart) : new Date(weekSun);
    const displayEnd = weekSat > monthEnd ? new Date(monthEnd) : new Date(weekSat);

    windows.push({
      actualStart: weekSun.toISOString().slice(0, 10),
      actualEnd: weekSat.toISOString().slice(0, 10),
      displayStart: displayStart.toISOString().slice(0, 10),
      displayEnd: displayEnd.toISOString().slice(0, 10),
    });

    cursor.setDate(cursor.getDate() + 7);
  }

  return windows;
}

function buildCategoryBreakdown(
  txArr: Array<{ amount?: number | null; category?: string | null }>
): CategorySpendRow[] {
  const totals = txArr.reduce<Record<string, number>>((acc, tx) => {
    const cat = tx.category ?? "Other";
    acc[cat] = (acc[cat] ?? 0) + Number(tx.amount ?? 0);
    return acc;
  }, {});
  return Object.entries(totals)
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount || a.category.localeCompare(b.category));
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
    .select("amount,category,date,status")
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

  const categoryBreakdown = buildCategoryBreakdown(weeklyTx ?? []);
  const topCategory = categoryBreakdown[0]?.category ?? "N/A";

  // Build per-week breakdown for all elapsed weeks in the current month
  const allMonthTxArr = monthlyTx ?? [];
  const weekWindows = getWeekWindowsForMonth(range);

  const weeksOfMonth: WeekOfMonthRow[] = weekWindows
    .filter((w) => w.displayStart <= range.weekEnd) // only weeks that have started
    .map((w, i) => {
      const txInWeek = allMonthTxArr.filter(
        (tx) => tx.date >= w.actualStart && tx.date <= w.actualEnd
      );
      const total = txInWeek.reduce((sum, tx) => sum + Number(tx.amount ?? 0), 0);
      return {
        weekLabel: `Week ${i + 1}`,
        weekStart: w.displayStart,
        weekEnd: w.displayEnd,
        total,
        categoryBreakdown: buildCategoryBreakdown(txInWeek),
        isCurrent: w.actualStart === range.weekStart,
      };
    });

  return {
    weeklyTotal,
    monthlyTotal,
    topCategory,
    weeklyTxCount: (weeklyTx ?? []).length,
    categoryBreakdown,
    weeksOfMonth,
  };
}
