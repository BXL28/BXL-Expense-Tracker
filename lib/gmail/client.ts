import { google } from "googleapis";
import type { gmail_v1 } from "googleapis";

const GMAIL_SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.send",
];

function getGoogleEnv() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;

  if (!clientId || !clientSecret) {
    throw new Error(
      "Missing Google env vars. Required: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET."
    );
  }

  return { clientId, clientSecret, redirectUri: redirectUri ?? null };
}

/** redirectUri must match Authorized redirect URIs in Google Cloud and the URL Google redirects to (including port). */
export function createGoogleOAuthClient(redirectUriOverride?: string | null) {
  const { clientId, clientSecret, redirectUri: envRedirect } = getGoogleEnv();
  const redirectUri = redirectUriOverride ?? envRedirect;
  if (!redirectUri) {
    throw new Error(
      "Missing OAuth redirect URI. Use /api/google/connect (dynamic) or set GOOGLE_REDIRECT_URI in .env.local."
    );
  }
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

export function buildGoogleOAuthUrl(state: string, redirectUri: string) {
  const client = createGoogleOAuthClient(redirectUri);
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: GMAIL_SCOPES,
    state,
  });
}

export async function exchangeCodeForTokens(code: string, redirectUri: string) {
  const client = createGoogleOAuthClient(redirectUri);
  const { tokens } = await client.getToken(code);
  return tokens;
}

export async function fetchGoogleUserEmail(
  accessToken: string,
  oauthRedirectUri?: string | null
) {
  const client = createGoogleOAuthClient(oauthRedirectUri ?? undefined);
  client.setCredentials({ access_token: accessToken });
  const oauth2 = google.oauth2("v2");
  const { data } = await oauth2.userinfo.get({
    auth: client,
  });
  return data.email ?? "";
}

export function createGmailClient(
  tokens: {
    access_token?: string | null;
    refresh_token?: string | null;
    expiry_date?: number | null;
  },
  oauthRedirectUri?: string | null
) {
  const client = createGoogleOAuthClient(oauthRedirectUri ?? undefined);
  client.setCredentials({
    access_token: tokens.access_token ?? undefined,
    refresh_token: tokens.refresh_token ?? undefined,
    expiry_date: tokens.expiry_date ?? undefined,
  });
  return google.gmail({ version: "v1", auth: client });
}

/**
 * Scotia InfoAlerts: "Last five transactions" (credit card and day-to-day). Ingest filters
 * to credit-card-only in `gmailIngest`; this query stays broad so odd subjects still list.
 */
export function getScotiaAlertGmailQuery() {
  return 'from:infoalerts@scotiabank.com subject:"Last five transactions" newer_than:7d';
}

export async function listRecentScotiaMessages(
  gmail: gmail_v1.Gmail,
  maxResults = 20
) {
  const q = getScotiaAlertGmailQuery();
  const { data } = await gmail.users.messages.list({
    userId: "me",
    maxResults,
    q,
  });
  return data.messages ?? [];
}

export function getMessageHeader(
  message: gmail_v1.Schema$Message,
  headerName: string
): string | null {
  const headers = message.payload?.headers;
  if (!headers?.length) return null;
  const found = headers.find((h) => h.name?.toLowerCase() === headerName.toLowerCase());
  return found?.value ?? null;
}

export async function getGmailMessage(gmail: gmail_v1.Gmail, messageId: string) {
  const { data } = await gmail.users.messages.get({
    userId: "me",
    id: messageId,
    format: "full",
  });
  return data;
}

function extractPlainTextFromPayload(payload?: gmail_v1.Schema$MessagePart): string {
  if (!payload) return "";

  if (payload.mimeType === "text/plain" && payload.body?.data) {
    return Buffer.from(payload.body.data, "base64").toString("utf8");
  }

  if (payload.parts?.length) {
    for (const part of payload.parts) {
      const text = extractPlainTextFromPayload(part);
      if (text) return text;
    }
  }

  if (payload.body?.data) {
    return Buffer.from(payload.body.data, "base64").toString("utf8");
  }

  return "";
}

export function getMessagePlainText(message: gmail_v1.Schema$Message) {
  return extractPlainTextFromPayload(message.payload);
}

/** First text/html part base64-decoded (raw); ingest still prefers plain text — use debug to spot HTML-only alerts. */
function extractHtmlFromPayload(payload?: gmail_v1.Schema$MessagePart): string {
  if (!payload) return "";
  if (payload.mimeType === "text/html" && payload.body?.data) {
    return Buffer.from(payload.body.data, "base64").toString("utf8");
  }
  if (payload.parts?.length) {
    for (const part of payload.parts) {
      const html = extractHtmlFromPayload(part);
      if (html) return html;
    }
  }
  return "";
}

export function getMessageHtmlRaw(message: gmail_v1.Schema$Message) {
  return extractHtmlFromPayload(message.payload);
}

export async function sendGmailMessage(gmail: gmail_v1.Gmail, to: string, subject: string, body: string) {
  const message = [
    `To: ${to}`,
    "Content-Type: text/plain; charset=utf-8",
    "MIME-Version: 1.0",
    `Subject: ${subject}`,
    "",
    body,
  ].join("\n");

  const raw = Buffer.from(message)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  await gmail.users.messages.send({
    userId: "me",
    requestBody: { raw },
  });
}

