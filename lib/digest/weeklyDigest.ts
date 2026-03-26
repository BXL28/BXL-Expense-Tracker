import type { CategorySpendRow } from "@/lib/digest/weeklyDigestMetrics";

type DigestInput = {
  weeklyTotal: number;
  monthlyTotal: number;
  topCategory: string;
  categoryBreakdown: CategorySpendRow[];
  weekStart: string;
  weekEnd: string;
  monthLabel: string;
};

export function buildWeeklyDigestEmail(input: DigestInput) {
  const categoryLines =
    input.categoryBreakdown.length === 0
      ? ["  - No posted transactions this week"]
      : input.categoryBreakdown.map(
          (row) => `  - ${row.category}: $${row.amount.toFixed(2)}`
        );

  return [
    "Hi,",
    "",
    `BXL Weekly Spend Digest`,
    `${input.weekStart} to ${input.weekEnd}`,
    "----------------------------------------",
    "",
    "Highlights",
    `- Weekly spend: $${input.weeklyTotal.toFixed(2)}`,
    `- Month-to-date spend (${input.monthLabel}): $${input.monthlyTotal.toFixed(2)}`,
    `- Top category: ${input.topCategory}`,
    "",
    "Spend by category",
    ...categoryLines,
    "",
    "Notes",
    "- Based on posted transactions from synced Scotia credit-card alerts",
    `- Week window: ${input.weekStart} to ${input.weekEnd} (Sun-Sat)`,
    "",
    "BXL Expense Tracker",
  ].join("\n");
}
