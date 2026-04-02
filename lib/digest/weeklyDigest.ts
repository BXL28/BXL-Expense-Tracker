import type { CategorySpendRow, WeekOfMonthRow } from "@/lib/digest/weeklyDigestMetrics";

type DigestInput = {
  weeklyTotal: number;
  monthlyTotal: number;
  topCategory: string;
  categoryBreakdown: CategorySpendRow[];
  weekStart: string;
  weekEnd: string;
  monthLabel: string;
  weeksOfMonth: WeekOfMonthRow[];
};

/** Converts "2026-03-01" → "Mar 1" */
function fmt(dateStr: string): string {
  const [y, mo, d] = dateStr.split("-").map(Number);
  return new Date(y, mo - 1, d).toLocaleString("en-US", { month: "short", day: "numeric" });
}

export function buildWeeklyDigestEmail(input: DigestInput): string {
  const weekRangeLabel = `${fmt(input.weekStart)} – ${fmt(input.weekEnd)}`;

  // ── This week: category breakdown ─────────────────────────────────────────
  const categoryLines =
    input.categoryBreakdown.length === 0
      ? ["  No posted transactions this week."]
      : input.categoryBreakdown.map((row) => `  - ${row.category}: $${row.amount.toFixed(2)}`);

  // ── Month breakdown rows (aligned columns) ────────────────────────────────
  const weekLabels = input.weeksOfMonth.map(
    (w) => `${w.weekLabel}  (${fmt(w.weekStart)} – ${fmt(w.weekEnd)})`
  );
  const maxLabelLen = weekLabels.reduce((max, l) => Math.max(max, l.length), 0);

  const monthRows = input.weeksOfMonth.map((w, i) => {
    const label = weekLabels[i].padEnd(maxLabelLen);
    const amount = `$${w.total.toFixed(2)}`;
    const marker = w.isCurrent ? "  ← this week" : "";
    return `  ${label}   ${amount}${marker}`;
  });

  const dividerLen = maxLabelLen + 14;
  const divider = "─".repeat(dividerLen);
  const totalLabel = "Total MTD:".padEnd(maxLabelLen);

  // ── Assemble ───────────────────────────────────────────────────────────────
  return [
    "Hi,",
    "",
    `BXL Weekly Spend Digest — ${input.monthLabel}`,
    `Week: ${weekRangeLabel}`,
    "============================================",
    "",
    "HIGHLIGHTS",
    `  This week:       $${input.weeklyTotal.toFixed(2)}`,
    `  Month-to-date:   $${input.monthlyTotal.toFixed(2)}`,
    `  Top category:    ${input.topCategory}`,
    "",
    `THIS WEEK — ${weekRangeLabel}`,
    ...categoryLines,
    "",
    `MONTH BREAKDOWN — ${input.monthLabel}`,
    ...monthRows,
    `  ${divider}`,
    `  ${totalLabel}   $${input.monthlyTotal.toFixed(2)}`,
    "",
    "Notes",
    "  Based on posted transactions from synced Scotia credit-card alerts.",
    `  Week windows follow Sun–Sat calendar.`,
    "",
    "BXL Expense Tracker",
  ].join("\n");
}
