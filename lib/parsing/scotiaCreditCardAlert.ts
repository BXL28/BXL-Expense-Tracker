/**
 * Scotia InfoAlerts include both credit-card and day-to-day / banking “last five transactions”
 * emails. We only ingest credit-card alerts into the expense tracker.
 */

export function isScotiaCreditCardAlert(subject: string | null | undefined, body: string): boolean {
  const sub = (subject ?? "").trim();
  const text = `${sub}\n${body}`.replace(/\s+/g, " ");
  const t = text.slice(0, 12000);

  if (/\bday\s*[- ]?to\s*[- ]?day\b/i.test(sub)) return false;
  if (/\bvisa\s+debit\b/i.test(t)) return false;

  const subHasCreditCard = /\bcredit\s+card\b/i.test(sub);

  if (/\bdebit\b/i.test(sub) && !subHasCreditCard) return false;

  if (/\bcredit\s+card\b/i.test(t)) return true;
  if (/\bcredit\s+accounts?\b/i.test(t)) return true;
  if (/\bscotia\s*cards?\b/i.test(t)) return true;
  if (/\bmastercard\b/i.test(t)) return true;
  if (/\b(amex|american express)\b/i.test(t)) return true;
  if (/\bvisa\b/i.test(t) && !/\bvisa\s+debit\b/i.test(t)) return true;

  if (/\bscotia\b/i.test(t) && /\b(visa|mastercard|amex)\b/i.test(t)) return true;

  if (/credit/i.test(sub) && /account/i.test(sub)) return true;

  if (/\bday\s*[- ]?to\s*[- ]?day\b/i.test(t)) return false;
  if (/\bchequing\b/i.test(t)) return false;
  if (/\bsavings\s+account\b/i.test(t)) return false;

  return false;
}
