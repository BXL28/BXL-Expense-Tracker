import { NextResponse } from "next/server";
import { buildGoogleOAuthUrl } from "@/lib/gmail/client";
import { encodeSignedState } from "@/lib/security/state";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const userId = url.searchParams.get("user_id");
  const loginHint = url.searchParams.get("login_hint") ?? undefined;

  if (!userId) {
    return NextResponse.json(
      { error: "Missing user_id query parameter." },
      { status: 400 }
    );
  }

  const state = encodeSignedState({
    userId,
    ts: String(Date.now()),
  });

  const redirectUri = new URL("/api/google/callback", request.url).href;
  const authUrl = buildGoogleOAuthUrl(state, redirectUri, loginHint);
  return NextResponse.redirect(authUrl);
}

