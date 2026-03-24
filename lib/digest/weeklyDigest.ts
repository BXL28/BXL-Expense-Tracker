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
      ? ["  (no posted transactions this week)"]
      : input.categoryBreakdown.map(
          (row) => `  • ${row.category}: $${row.amount.toFixed(2)}`
        );

  return [
    "Hi,",
    "",
    `Here is your BXL Expense Tracker summary for ${input.weekStart} to ${input.weekEnd}.`,
    "",
    `- Weekly spend: $${input.weeklyTotal.toFixed(2)}`,
    `- Month-to-date spend (${input.monthLabel}): $${input.monthlyTotal.toFixed(2)}`,
    `- Top category this week: ${input.topCategory}`,
    "",
    "Spending by category (this week):",
    ...categoryLines,
    "",
    "This digest uses posted transactions from your synced Scotia credit-card alerts.",
    "",
    "BXL Expense Tracker",
  ].join("\n");
}
