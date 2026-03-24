import { NextResponse } from "next/server";
import {
  exchangeCodeForTokens,
  fetchGoogleUserEmail,
} from "@/lib/gmail/client";
import { decodeSignedState } from "@/lib/security/state";
import { encryptSecret } from "@/lib/security/encryption";
import { createServerSupabaseAdmin } from "@/lib/supabase/server";

type GoogleState = {
  userId: string;
  ts: string;
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  if (!code || !state) {
    return NextResponse.json({ error: "Missing code or state." }, { status: 400 });
  }

  try {
    const callbackUrl = new URL(request.url);
    const redirectUri = `${callbackUrl.origin}${callbackUrl.pathname}`.replace(/\/$/, "");

    const decoded = decodeSignedState<GoogleState>(state);
    const tokens = await exchangeCodeForTokens(code, redirectUri);

    if (!tokens.refresh_token || !tokens.access_token) {
      return NextResponse.json(
        { error: "Google did not return required tokens. Reconnect with consent." },
        { status: 400 }
      );
    }

    const googleEmail = await fetchGoogleUserEmail(tokens.access_token, redirectUri);
    const supabase = createServerSupabaseAdmin();

    const { error } = await supabase.from("gmail_connections").upsert(
      {
        user_id: decoded.userId,
        google_email: googleEmail || "unknown@gmail.com",
        refresh_token_encrypted: encryptSecret(tokens.refresh_token),
        access_token: tokens.access_token,
        access_token_expires_at: tokens.expiry_date
          ? new Date(tokens.expiry_date).toISOString()
          : null,
        oauth_redirect_uri: redirectUri,
      },
      { onConflict: "user_id" }
    );

    if (error) {
      console.error("[google/callback] gmail_connections upsert:", error);
      return NextResponse.json(
        {
          error: error.message,
          hint: "Run supabase/schema.sql in the SQL Editor and ensure SUPABASE_SERVICE_ROLE_KEY is set. user_id must exist in auth.users.",
        },
        { status: 500 }
      );
    }

    return NextResponse.redirect(new URL("/dashboard?gmail=connected", request.url));
  } catch (error) {
    console.error("[google/callback]", error);
    const message = error instanceof Error ? error.message : "OAuth callback failed.";
    return NextResponse.json(
      {
        error: message,
        hint:
          "For invalid_grant: start connect again (codes are one-time), do not refresh the callback URL. Ensure this exact redirect is in Google Cloud: the URL you see in the address bar without ?query (e.g. http://localhost:3000/api/google/callback).",
      },
      { status: 500 }
    );
  }
}

