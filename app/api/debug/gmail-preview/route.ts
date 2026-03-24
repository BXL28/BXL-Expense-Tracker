import { NextResponse } from "next/server";
import {
  createGmailClient,
  getGmailMessage,
  getMessageHeader,
  getMessageHtmlRaw,
  getMessagePlainText,
  getScotiaAlertGmailQuery,
  listRecentScotiaMessages,
} from "@/lib/gmail/client";
import { emailBodyForParsing } from "@/lib/parsing/emailBody";
import { isScotiaCreditCardAlert } from "@/lib/parsing/scotiaCreditCardAlert";
import { extractTransactionsWithGemini } from "@/lib/parsing/geminiExtractor";
import { parseScotiaEmailWithRules } from "@/lib/parsing/scotiaParser";
import { decryptSecret } from "@/lib/security/encryption";
import { createServerSupabaseAdmin, createServerSupabaseForAccessToken } from "@/lib/supabase/server";
import type { GmailConnectionRow } from "@/lib/ingest/gmailIngest";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const accessToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!accessToken) {
    return NextResponse.json(
      {
        error: "Missing Authorization: Bearer <supabase_access_token>",
        hint: "From the dashboard: open DevTools → Application → Local Storage, or call supabase.auth.getSession() and use session.access_token.",
      },
      { status: 401 }
    );
  }

  const url = new URL(request.url);
  const limit = Math.min(25, Math.max(1, Number(url.searchParams.get("limit")) || 8));

  const userClient = createServerSupabaseForAccessToken(accessToken);
  const {
    data: { user },
    error: userError,
  } = await userClient.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Invalid or expired session." }, { status: 401 });
  }

  const supabase = createServerSupabaseAdmin();
  const { data: row, error: connError } = await supabase
    .from("gmail_connections")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (connError) {
    return NextResponse.json({ error: connError.message }, { status: 500 });
  }

  if (!row) {
    return NextResponse.json(
      { error: "Gmail not connected.", gmailQuery: getScotiaAlertGmailQuery(), messages: [] },
      { status: 400 }
    );
  }

  const connection = row as GmailConnectionRow;

  let gmail;
  try {
    gmail = createGmailClient(
      {
        access_token: connection.access_token,
        refresh_token: decryptSecret(connection.refresh_token_encrypted),
      },
      connection.oauth_redirect_uri ?? undefined
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Gmail client failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  const gmailQuery = getScotiaAlertGmailQuery();
  const list = await listRecentScotiaMessages(gmail, limit);

  const messages: Array<Record<string, unknown>> = [];

  for (const summary of list) {
    if (!summary.id) continue;
    const full = await getGmailMessage(gmail, summary.id);
    const subject = getMessageHeader(full, "Subject");
    const from = getMessageHeader(full, "From");
    const plain = getMessagePlainText(full);
    const htmlRaw = getMessageHtmlRaw(full);
    const bodyForRules = emailBodyForParsing(plain, htmlRaw);
    const plainStripped = plain.trim();
    const creditCardAlert = isScotiaCreditCardAlert(subject, bodyForRules);
    const gemini = creditCardAlert ? await extractTransactionsWithGemini(bodyForRules) : [];
    const rules = creditCardAlert ? parseScotiaEmailWithRules(bodyForRules) : [];

    messages.push({
      id: full.id,
      threadId: full.threadId,
      subject,
      from,
      creditCardAlert,
      wouldIngest: Boolean(bodyForRules.trim()) && creditCardAlert,
      internalDate: full.internalDate,
      snippet: full.snippet ?? null,
      plainTextChars: plainStripped.length,
      htmlChars: htmlRaw.length,
      usedBodyForParsing: plainStripped ? "text/plain" : htmlRaw.trim() ? "text/html→stripped" : "none",
      bodyForParsingPreview:
        bodyForRules.length > 0
          ? bodyForRules.slice(0, 1200) + (bodyForRules.length > 1200 ? "…" : "")
          : null,
      parsedByGemini: { count: gemini.length, transactions: gemini },
      parsedByRules: { count: rules.length, transactions: rules },
    });
  }

  return NextResponse.json({
    ok: true,
    userId: user.id,
    googleEmail: connection.google_email,
    gmailQuery,
    messageListCount: list.length,
    note: "This endpoint does not write to the database. Compare parsedByGemini vs parsedByRules; if both are 0 and plainTextChars is 0, the alert may be images-only or heavy HTML.",
    messages,
  });
}
