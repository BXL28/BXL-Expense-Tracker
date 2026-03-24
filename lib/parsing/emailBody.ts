/** Prefer plain text; if empty, strip HTML tags for parser-friendly text (Scotia alerts are often HTML). */
export function emailBodyForParsing(plainText: string, htmlRaw: string): string {
  const plain = plainText.trim();
  if (plain) return plain;
  if (!htmlRaw?.trim()) return "";
  return htmlRaw
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
