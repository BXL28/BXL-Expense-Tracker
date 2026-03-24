import { NextResponse } from "next/server";
import { assertCronSecret } from "@/lib/security/state";
import { createServerSupabaseAdmin } from "@/lib/supabase/server";
import {
  ingestGmailForConnection,
  type GmailConnectionRow,
} from "@/lib/ingest/gmailIngest";

export async function GET(request: Request) {
  if (!assertCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized cron request." }, { status: 401 });
  }

  const supabase = createServerSupabaseAdmin();
  const { data: connections, error: connectionError } = await supabase
    .from("gmail_connections")
    .select("*");

  if (connectionError) {
    return NextResponse.json({ error: connectionError.message }, { status: 500 });
  }

  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  let upsertFailures = 0;
  let emailsMatched = 0;
  const parseErrors: Array<{ user_id: string; message_id: string }> = [];
  const fatalErrors: string[] = [];

  for (const row of connections ?? []) {
    const connection = row as GmailConnectionRow;
    const result = await ingestGmailForConnection(supabase, connection);
    inserted += result.inserted;
    updated += result.updated;
    skipped += result.skipped;
    upsertFailures += result.upsertFailures;
    emailsMatched += result.emailsMatched;
    parseErrors.push(...result.parseErrors);
    if (result.fatalError) fatalErrors.push(`${connection.user_id}: ${result.fatalError}`);
  }

  return NextResponse.json({
    ok: true,
    processedUsers: connections?.length ?? 0,
    inserted,
    updated,
    skipped,
    upsertFailures,
    emailsMatched,
    parseErrors,
    fatalErrors,
  });
}
