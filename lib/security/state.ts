import { createHmac, timingSafeEqual } from "crypto";

function getStateSecret() {
  const secret = process.env.GOOGLE_STATE_SECRET ?? process.env.CRON_SECRET;
  if (!secret) {
    throw new Error("Missing GOOGLE_STATE_SECRET or CRON_SECRET for state signing.");
  }
  return secret;
}

export function signState(payload: string) {
  return createHmac("sha256", getStateSecret()).update(payload).digest("hex");
}

export function encodeSignedState(payload: Record<string, string>) {
  const json = JSON.stringify(payload);
  const body = Buffer.from(json, "utf8").toString("base64url");
  const sig = signState(body);
  return `${body}.${sig}`;
}

export function decodeSignedState<T>(state: string): T {
  const [body, sig] = state.split(".");
  if (!body || !sig) {
    throw new Error("Invalid OAuth state.");
  }

  const expectedSig = signState(body);
  const sigBuf = Buffer.from(sig, "utf8");
  const expectedBuf = Buffer.from(expectedSig, "utf8");
  if (sigBuf.length !== expectedBuf.length) {
    throw new Error("Invalid OAuth state signature.");
  }
  if (!timingSafeEqual(sigBuf, expectedBuf)) {
    throw new Error("Invalid OAuth state signature.");
  }

  return JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as T;
}

/**
 * Vercel Cron sends `Authorization: Bearer <CRON_SECRET>` when CRON_SECRET is set
 * (see https://vercel.com/docs/cron-jobs/manage-cron-jobs). We also accept
 * `x-cron-secret` for manual / non-Vercel callers (matches README examples).
 */
export function assertCronSecret(request: Request) {
  const expected = process.env.CRON_SECRET;
  if (!expected) throw new Error("Missing CRON_SECRET env var.");
  const bearer = request.headers.get("authorization");
  if (bearer === `Bearer ${expected}`) return true;
  const header = request.headers.get("x-cron-secret");
  return header === expected;
}

