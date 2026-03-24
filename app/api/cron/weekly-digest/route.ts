import { NextResponse } from "next/server";
import { createServerSupabaseAdmin } from "@/lib/supabase/server";
import { assertCronSecret } from "@/lib/security/state";
import { createGmailClient, sendGmailMessage } from "@/lib/gmail/client";
import { decryptSecret } from "@/lib/security/encryption";
import { buildWeeklyDigestEmail } from "@/lib/digest/weeklyDigest";
import { fetchWeeklyDigestMetrics, getDigestDateRange } from "@/lib/digest/weeklyDigestMetrics";
import {
  getZonedCalendarDate,
  isUserDigestDue,
  normalizeDigestPrefs,
  type UserDigestPrefs,
} from "@/lib/digest/userDigestSlot";

type ProfileDigestRow = {
  id: string;
  digest_weekday: number | null;
  digest_hour: number | null;
  digest_minute: number | null;
  digest_timezone: string | null;
};

function prefsFromProfileRow(p: ProfileDigestRow | undefined): UserDigestPrefs {
  if (!p) return normalizeDigestPrefs(null);
  return normalizeDigestPrefs({
    digestWeekday: p.digest_weekday ?? undefined,
    digestHour: p.digest_hour ?? undefined,
    digestMinute: p.digest_minute ?? undefined,
    digestTimezone: p.digest_timezone ?? undefined,
  });
}

export async function GET(request: Request) {
  if (!assertCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized cron request." }, { status: 401 });
  }

  const supabase = createServerSupabaseAdmin();
  const { data: connections, error } = await supabase.from("gmail_connections").select("*");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const userIds = [...new Set((connections ?? []).map((c) => c.user_id))];
  const profileByUserId = new Map<string, ProfileDigestRow>();
  if (userIds.length > 0) {
    const { data: profiles, error: profErr } = await supabase
      .from("profiles")
      .select("id, digest_weekday, digest_hour, digest_minute, digest_timezone")
      .in("id", userIds);
    if (profErr) return NextResponse.json({ error: profErr.message }, { status: 500 });
    for (const row of profiles ?? []) {
      profileByUserId.set(String((row as ProfileDigestRow).id), row as ProfileDigestRow);
    }
  }

  const range = getDigestDateRange();
  let sent = 0;
  const failures: Array<{ user_id: string; email: string; error: string }> = [];
  let attempted = 0;
  let skippedWrongSlot = 0;
  let skippedAlreadySentToday = 0;

  const now = new Date();

  for (const raw of connections ?? []) {
    const connection = raw as typeof raw & { weekly_digest_last_calendar_date?: string | null };
    attempted += 1;

    const prefs = prefsFromProfileRow(profileByUserId.get(String(connection.user_id)));

    if (!isUserDigestDue(now, prefs)) {
      skippedWrongSlot += 1;
      continue;
    }

    const todayInUserTz = getZonedCalendarDate(now, prefs.digestTimezone);
    if (
      todayInUserTz &&
      connection.weekly_digest_last_calendar_date === todayInUserTz
    ) {
      skippedAlreadySentToday += 1;
      continue;
    }

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

      if (todayInUserTz) {
        await supabase
          .from("gmail_connections")
          .update({ weekly_digest_last_calendar_date: todayInUserTz })
          .eq("user_id", connection.user_id);
      }
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
    skippedWrongSlot,
    skippedAlreadySentToday,
    users: connections?.length ?? 0,
    failures,
  });
}
