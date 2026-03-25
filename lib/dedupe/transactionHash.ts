import { createHash } from "crypto";

export type ParsedTransaction = {
  date: string;
  merchant: string;
  amount: number;
  category: string;
  status: "pending" | "posted";
  sourceEmailId?: string;
  parseConfidence?: number;
};

export function makeTransactionHash(userId: string, tx: ParsedTransaction) {
  const normalizedMerchant = tx.merchant.trim().toLowerCase().replace(/\s+/g, " ");
  const amount = tx.amount.toFixed(2);
  const input = `${userId}|${normalizedMerchant}|${amount}`;
  return createHash("sha256").update(input).digest("hex");
}

export function shouldOverwriteExistingStatus(
  previousStatus: string | null | undefined,
  incomingStatus: "pending" | "posted"
) {
  if (!previousStatus) return true;
  if (previousStatus === "pending" && incomingStatus === "posted") return true;
  return false;
}

