import { NextResponse } from "next/server";
import { createGmailClient, sendGmailMessage } from "@/lib/gmail/client";
import { buildWeeklyDigestEmail } from "@/lib/digest/weeklyDigest";
import {
  fetchWeeklyDigestMetrics,
  getDigestDateRange,
} from "@/lib/digest/weeklyDigestMetrics";
import { decryptSecret } from "@/lib/security/encryption";
import { createServerSupabaseForAccessToken } from "@/lib/supabase/server";
import type { GmailConnectionRow } from "@/lib/ingest/gmailIngest";

/**
 * Preview or send the weekly digest for the signed-in user (same content as cron).
 * GET: dry run — returns subject/body/metrics, no email.
 * POST: sends one digest to gmail_connections.google_email for this user.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const accessToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!accessToken) {
    return NextResponse.json(
      {
        error: "Missing Authorization: Bearer <supabase_access_token>",
        hint: "Same as Gmail preview — use the dashboard session token.",
      },
      { status: 401 }
    );
  }

  const supabase = createServerSupabaseForAccessToken(accessToken);
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Invalid or expired session." }, { status: 401 });
  }

  const { data: connection, error: connError } = await supabase
    .from("gmail_connections")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (connError) {
    return NextResponse.json({ error: connError.message }, { status: 500 });
  }

  if (!connection) {
    return NextResponse.json(
      { error: "Gmail not connected. Connect Gmail first, then try again." },
      { status: 400 }
    );
  }

  const row = connection as GmailConnectionRow;
  const range = getDigestDateRange();
  const metrics = await fetchWeeklyDigestMetrics(supabase, user.id, range);
  const subject = `BXL Weekly Spend Digest (${range.weekStart} - ${range.weekEnd})`;
  const body = buildWeeklyDigestEmail({
    weeklyTotal: metrics.weeklyTotal,
    monthlyTotal: metrics.monthlyTotal,
    topCategory: metrics.topCategory,
    categoryBreakdown: metrics.categoryBreakdown,
    weekStart: range.weekStart,
    weekEnd: range.weekEnd,
    monthLabel: range.monthLabel,
    weeksOfMonth: metrics.weeksOfMonth,
  });

  return NextResponse.json({
    ok: true,
    dryRun: true,
    wouldSendTo: row.google_email,
    range,
    metrics,
    subject,
    body,
  });
}

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  const accessToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!accessToken) {
    return NextResponse.json(
      { error: "Missing Authorization: Bearer <supabase_access_token>" },
      { status: 401 }
    );
  }

  const supabase = createServerSupabaseForAccessToken(accessToken);
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Invalid or expired session." }, { status: 401 });
  }

  const { data: connection, error: connError } = await supabase
    .from("gmail_connections")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (connError) {
    return NextResponse.json({ error: connError.message }, { status: 500 });
  }

  if (!connection) {
    return NextResponse.json(
      { error: "Gmail not connected. Connect Gmail before sending a digest." },
      { status: 400 }
    );
  }

  const row = connection as GmailConnectionRow;
  const range = getDigestDateRange();
  const metrics = await fetchWeeklyDigestMetrics(supabase, user.id, range);
  const subject = `BXL Weekly Spend Digest (${range.weekStart} - ${range.weekEnd})`;
  const body = buildWeeklyDigestEmail({
    weeklyTotal: metrics.weeklyTotal,
    monthlyTotal: metrics.monthlyTotal,
    topCategory: metrics.topCategory,
    categoryBreakdown: metrics.categoryBreakdown,
    weekStart: range.weekStart,
    weekEnd: range.weekEnd,
    monthLabel: range.monthLabel,
    weeksOfMonth: metrics.weeksOfMonth,
  });

  try {
    const gmail = createGmailClient(
      {
        access_token: row.access_token,
        refresh_token: decryptSecret(row.refresh_token_encrypted),
      },
      row.oauth_redirect_uri ?? undefined
    );
    await sendGmailMessage(gmail, row.google_email, subject, body);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { ok: false, error: "Failed to send email via Gmail.", detail: msg },
      { status: 502 }
    );
  }

  return NextResponse.json({
    ok: true,
    sentTo: row.google_email,
    range,
    metrics,
    subject,
  });
}
