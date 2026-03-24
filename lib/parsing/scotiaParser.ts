import type { ParsedTransaction } from "../dedupe/transactionHash";
import {
  isDepositContextAroundPair,
  isExcludedFromSpendingMerchant,
  lineLooksLikeDepositRow,
} from "./spendFilter";

function parseDateCandidate(raw: string) {
  const cleaned = raw.trim();
  const parsed = new Date(cleaned);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }
  return new Date().toISOString().slice(0, 10);
}

function guessCategory(merchant: string): string {
  const m = merchant.toLowerCase();
  if (/(uber|lyft|taxi|transit|metro|bus|gas|metrolinx|gotransit)/.test(m)) return "Transport";
  if (/(restaurant|cafe|coffee|grocery|market|food|tim\s*horton|timhorton)/.test(m)) return "Food";
  if (/(pharm|clinic|hospital)/.test(m)) return "Health";
  if (/(hydro|electric|internet|phone|utility)/.test(m)) return "Utilities";
  if (/(amazon|shop|store|walmart|costco)/.test(m)) return "Shopping";
  return "Other";
}

/** One physical line with amount at end (plain-text multipart emails). */
function parseScotiaByLines(content: string): ParsedTransaction[] {
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const results: ParsedTransaction[] = [];
  const amountRegex = /\$?\s?(\d{1,6}(?:,\d{3})*(?:\.\d{2})?)\s*$/;
  const dateRegex = /(\d{4}-\d{2}-\d{2}|[A-Za-z]{3,9}\s+\d{1,2},?\s+\d{4})/;

  for (const line of lines) {
    // Stripped HTML is often one huge "line"; end-anchored $ then captures junk as merchant.
    if (line.length > 220) continue;
    if (lineLooksLikeDepositRow(line)) continue;
    if (!/\$/.test(line) && !/\d+\.\d{2}\s*$/.test(line)) continue;

    const amountMatch = line.match(amountRegex);
    if (!amountMatch) continue;
    const amount = Number(amountMatch[1].replace(/,/g, ""));
    if (!Number.isFinite(amount) || amount <= 0) continue;

    const dateMatch = line.match(dateRegex);
    const merchantGuess = line
      .replace(amountMatch[0], "")
      .replace(dateMatch?.[0] ?? "", "")
      .replace(/pending/gi, "")
      .replace(/posted/gi, "")
      .trim()
      .replace(/\s+/g, " ");

    const status = /pending/i.test(line) ? "pending" : "posted";
    const merchant = merchantGuess || "Unknown Merchant";
    if (merchant.length > 70) continue;
    if (isExcludedFromSpendingMerchant(merchant)) continue;

    const date = parseDateCandidate(dateMatch?.[0] ?? new Date().toDateString());

    results.push({
      date,
      merchant,
      amount,
      category: guessCategory(merchant),
      status,
      parseConfidence: 0.55,
    });
  }

  return results;
}

/**
 * HTML-stripped emails become one long line; Scotia lines look like:
 * TIMHORTONS#2018 $6.20  METROLINX-GOTRANSIT $10.00
 * Scan the whole blob for MERCHANT $amount pairs.
 */
function parseScotiaByGlobalPairs(content: string): ParsedTransaction[] {
  const singleLine = content.replace(/\s+/g, " ").trim();
  const results: ParsedTransaction[] = [];

  const re =
    /\b([A-Za-z][A-Za-z0-9#*.\-]{1,55})\s+\$(\d{1,6}(?:,\d{3})*\.\d{2})\b/g;
  let m: RegExpExecArray | null;
  const today = new Date().toISOString().slice(0, 10);

  while ((m = re.exec(singleLine)) !== null) {
    const merchant = m[1].trim();
    const amount = Number(m[2].replace(/,/g, ""));
    if (!Number.isFinite(amount) || amount <= 0) continue;

    if (
      /^(are|the|your|last|credit|account|transactions|for|and|sign|online|mobile|information|more)$/i.test(
        merchant
      )
    ) {
      continue;
    }
    if (merchant.length < 4) continue;
    if (isExcludedFromSpendingMerchant(merchant)) continue;
    const pairStart = m.index;
    const pairEnd = m.index + m[0].length;
    if (isDepositContextAroundPair(singleLine, pairStart, pairEnd)) continue;

    results.push({
      date: today,
      merchant,
      amount,
      category: guessCategory(merchant),
      status: "posted",
      parseConfidence: 0.62,
    });
  }

  return results;
}

function dedupeByMerchantAmount(rows: ParsedTransaction[]): ParsedTransaction[] {
  const seen = new Set<string>();
  const out: ParsedTransaction[] = [];
  for (const tx of rows) {
    const key = `${tx.merchant.trim().toLowerCase()}|${tx.amount.toFixed(2)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(tx);
  }
  return out;
}

export function parseScotiaEmailWithRules(content: string): ParsedTransaction[] {
  const fromLines = parseScotiaByLines(content);
  const fromPairs = parseScotiaByGlobalPairs(content);
  return dedupeByMerchantAmount([...fromLines, ...fromPairs]);
}
