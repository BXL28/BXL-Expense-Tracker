import type { ParsedTransaction } from "../dedupe/transactionHash";

type GeminiCandidate = {
  date?: string;
  merchant?: string;
  amount?: number;
  category?: string;
  status?: "pending" | "posted";
  confidence?: number;
};

function getGeminiApiKey() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  return key;
}

export async function extractTransactionsWithGemini(
  emailBody: string
): Promise<ParsedTransaction[]> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) return [];

  const prompt = `
You are extracting purchase / spending transactions from a Scotiabank credit card InfoAlert only.
Do NOT include deposits, autodeposits, e-Transfer credits, payroll, refunds, reversals, or other money-in rows—only credit-card outflows the user spent.
Return ONLY valid JSON in this exact shape:
{"transactions":[{"date":"YYYY-MM-DD","merchant":"string","amount":12.34,"category":"Food|Transport|Shopping|Utilities|Health|Other","status":"pending|posted","confidence":0.0}]}
If none found, return {"transactions":[]}.
Email content:
${emailBody.slice(0, 12000)}
`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.1, responseMimeType: "application/json" },
      }),
    }
  );

  if (!response.ok) {
    return [];
  }

  const data = (await response.json()) as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> };
    }>;
  };

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) return [];

  try {
    const parsed = JSON.parse(text) as { transactions?: GeminiCandidate[] };
    const safe = parsed.transactions ?? [];

    return safe
      .filter((item) => item.merchant && item.amount && item.date)
      .map((item) => ({
        date: String(item.date),
        merchant: String(item.merchant),
        amount: Number(item.amount),
        category: item.category ?? "Other",
        status: item.status === "pending" ? "pending" : "posted",
        parseConfidence: Math.max(0, Math.min(1, Number(item.confidence ?? 0.8))),
      }));
  } catch {
    return [];
  }
}

