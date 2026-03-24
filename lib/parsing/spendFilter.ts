import type { ParsedTransaction } from "@/lib/dedupe/transactionHash";

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Merchant / label text that indicates money in, not spending. */
export function isExcludedFromSpendingMerchant(merchant: string): boolean {
  const m = merchant.trim();
  if (!m) return false;
  // Plain label from the alert (parser/Gemini often uses this alone).
  if (/^deposit(?:ed|s)?$/i.test(m)) return true;
  return /\b(deposit(?:ed|s)?|autodeposit|direct\s+deposit|branch\s+deposit|atm\s+deposit|mobile\s+deposit|preauthorized\s+deposit|pad\s+deposit)\b/i.test(
    m
  );
}

/** Plain-text line that is clearly an inflow row (chequing daily alerts). */
export function lineLooksLikeDepositRow(line: string): boolean {
  if (/\bcredit\s+card\b/i.test(line)) return false;
  if (/\b(deposit(?:ed|s)?|autodeposit|direct\s+deposit|branch\s+deposit|atm\s+deposit|mobile\s+deposit|preauthorized\s+deposit)\b/i.test(line)) {
    return true;
  }
  return /\be[- ]?transfer\b/i.test(line) && /\b(autodeposit|deposited|deposit)\b/i.test(line);
}

/**
 * For MERCHANT $amount in a collapsed HTML line, skip if the snippet around the match
 * reads like an inflow (e.g. e-Transfer Autodeposit … $50).
 */
export function isDepositContextAroundPair(
  singleLine: string,
  pairStart: number,
  pairEnd: number
): boolean {
  const ctx = singleLine.slice(
    Math.max(0, pairStart - 80),
    Math.min(singleLine.length, pairEnd + 24)
  );
  if (/\bcredit\s+card\b/i.test(ctx)) return false;
  if (
    /\b(deposit(?:ed|s)?|autodeposit|direct\s+deposit|branch\s+deposit|atm\s+deposit|mobile\s+deposit)\b/i.test(
      ctx
    )
  ) {
    return true;
  }
  return (
    /\be[- ]?transfer\b/i.test(ctx) &&
    /\b(autodeposit|deposited|deposit)\b/i.test(ctx)
  );
}

/**
 * Keep only rows that look like spending. Uses merchant name plus a window of the email
 * body around the merchant so chequing-style "INTERAC … Autodeposit" rows are dropped
 * even if the parser only captured "INTERAC".
 */
export function isSpendTransaction(tx: ParsedTransaction, emailBody: string): boolean {
  const m = tx.merchant.trim();
  if (!m) return false;
  if (isExcludedFromSpendingMerchant(m)) return false;

  const flat = emailBody.replace(/\s+/g, " ");
  if (m.length < 4) return true;

  const re = new RegExp(escapeRegExp(m), "i");
  const found = flat.match(re);
  if (!found || found.index === undefined) return true;

  const idx = found.index;
  const win = flat.slice(
    Math.max(0, idx - 80),
    Math.min(flat.length, idx + m.length + 48)
  );
  if (/\bcredit\s+card\b/i.test(win)) return true;
  if (
    /\b(deposit(?:ed|s)?|autodeposit|direct\s+deposit|branch\s+deposit|atm\s+deposit|mobile\s+deposit)\b/i.test(
      win
    )
  ) {
    return false;
  }
  if (
    /\be[- ]?transfer\b/i.test(win) &&
    /\b(autodeposit|deposited|deposit)\b/i.test(win)
  ) {
    return false;
  }
  return true;
}

export function filterSpendTransactions(
  txs: ParsedTransaction[],
  emailBody: string
): ParsedTransaction[] {
  return txs.filter((tx) => isSpendTransaction(tx, emailBody));
}
