import { NextResponse } from "next/server";
import { createServerSupabaseAdmin, createServerSupabaseForAccessToken } from "@/lib/supabase/server";
import {
  ingestGmailForConnection,
  type GmailConnectionRow,
} from "@/lib/ingest/gmailIngest";

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  const accessToken = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7)
    : null;

  if (!accessToken) {
    return NextResponse.json(
      { error: "Missing Authorization: Bearer <supabase_access_token>" },
      { status: 401 }
    );
  }

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
      {
        error: "Gmail not connected.",
        hint: "Open /api/google/connect?user_id=<your_uid> and sign in with the Gmail account that receives Scotia alerts.",
      },
      { status: 400 }
    );
  }

  const result = await ingestGmailForConnection(supabase, row as GmailConnectionRow);

  return NextResponse.json({
    ok: true,
    userId: user.id,
    ...result,
  });
}
