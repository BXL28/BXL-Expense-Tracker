import { NextResponse } from "next/server";
import { createServerSupabaseAdmin } from "@/lib/supabase/server";
import { assertCronSecret } from "@/lib/security/state";
import { createGmailClient, sendGmailMessage } from "@/lib/gmail/client";
import { decryptSecret } from "@/lib/security/encryption";
import { buildWeeklyDigestEmail } from "@/lib/digest/weeklyDigest";
import { fetchWeeklyDigestMetrics, getDigestDateRange } from "@/lib/digest/weeklyDigestMetrics";

export async function GET(request: Request) {
  if (!assertCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized cron request." }, { status: 401 });
  }

  const supabase = createServerSupabaseAdmin();
  const { data: connections, error } = await supabase.from("gmail_connections").select("*");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const range = getDigestDateRange();
  let sent = 0;
  const failures: Array<{ user_id: string; email: string; error: string }> = [];
  let attempted = 0;

  for (const connection of connections ?? []) {
    attempted += 1;
    const metrics = await fetchWeeklyDigestMetrics(supabase, connection.user_id, range);

    try {
      const gmail = createGmailClient(
        {
          access_token: connection.access_token,
          refresh_token: decryptSecret(connection.refresh_token_encrypted),
        },
        (connection as { oauth_redirect_uri?: string | null }).oauth_redirect_uri ?? undefined
      );
      const subject = `BXL Weekly Spend Digest (${range.weekStart} - ${range.weekEnd})`;
      const body = buildWeeklyDigestEmail({
        weeklyTotal: metrics.weeklyTotal,
        monthlyTotal: metrics.monthlyTotal,
        topCategory: metrics.topCategory,
        categoryBreakdown: metrics.categoryBreakdown,
        weekStart: range.weekStart,
        weekEnd: range.weekEnd,
        monthLabel: range.monthLabel,
      });
      await sendGmailMessage(gmail, connection.google_email, subject, body);
      sent += 1;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[weekly-digest] send failed", {
        user_id: connection.user_id,
        email: connection.google_email,
        error: msg,
      });
      failures.push({
        user_id: connection.user_id,
        email: connection.google_email,
        error: msg,
      });
    }
  }

  return NextResponse.json({
    ok: true,
    attempted,
    sent,
    failed: failures.length,
    users: connections?.length ?? 0,
    failures,
  });
}

