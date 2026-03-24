type DigestInput = {
  weeklyTotal: number;
  monthlyTotal: number;
  topCategory: string;
  weekStart: string;
  weekEnd: string;
  monthLabel: string;
};

export function buildWeeklyDigestEmail(input: DigestInput) {
  return [
    "Hi,",
    "",
    `Here is your BXL Expense Tracker summary for ${input.weekStart} to ${input.weekEnd}.`,
    "",
    `- Weekly spend: $${input.weeklyTotal.toFixed(2)}`,
    `- Month-to-date spend (${input.monthLabel}): $${input.monthlyTotal.toFixed(2)}`,
    `- Top category this week: ${input.topCategory}`,
    "",
    "This digest uses posted transactions from your synced Scotia credit-card alerts.",
    "",
    "BXL Expense Tracker",
  ].join("\n");
}

