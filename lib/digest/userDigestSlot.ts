import { getNextDigestCronUtcAfter } from "@/lib/digest/digestCronSchedule";

export type UserDigestPrefs = {
  digestWeekday: number;
  digestHour: number;
  digestMinute: number;
  digestTimezone: string;
};

export const DEFAULT_DIGEST_PREFS: UserDigestPrefs = {
  digestWeekday: 0,
  digestHour: 8,
  digestMinute: 0,
  digestTimezone: "America/Toronto",
};

const DOW_MAP: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

export function normalizeDigestPrefs(row: Partial<UserDigestPrefs> | null | undefined): UserDigestPrefs {
  const tz = row?.digestTimezone?.trim() || DEFAULT_DIGEST_PREFS.digestTimezone;
  const wd = Number(row?.digestWeekday);
  const h = Number(row?.digestHour);
  const m = Number(row?.digestMinute);
  return {
    digestTimezone: tz,
    digestWeekday: Number.isFinite(wd) && wd >= 0 && wd <= 6 ? wd : DEFAULT_DIGEST_PREFS.digestWeekday,
    digestHour: Number.isFinite(h) && h >= 0 && h <= 23 ? h : DEFAULT_DIGEST_PREFS.digestHour,
    digestMinute: Number.isFinite(m) && m >= 0 && m <= 59 ? m : DEFAULT_DIGEST_PREFS.digestMinute,
  };
}

export function getZonedCalendarDate(now: Date, timeZone: string): string {
  const f = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = f.formatToParts(now);
  const y = parts.find((p) => p.type === "year")?.value;
  const mo = parts.find((p) => p.type === "month")?.value;
  const d = parts.find((p) => p.type === "day")?.value;
  if (!y || !mo || !d) return "";
  return `${y}-${mo}-${d}`;
}

export function getZonedWeekdayHourMinute(now: Date, timeZone: string) {
  const f = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = f.formatToParts(now);
  const m: Record<string, string> = {};
  for (const p of parts) {
    if (p.type !== "literal") m[p.type] = p.value;
  }
  const wd = DOW_MAP[m.weekday ?? ""] ?? 0;
  let hour = parseInt(m.hour ?? "0", 10);
  if (hour === 24) hour = 0;
  const minute = parseInt(m.minute ?? "0", 10);
  return { weekday: wd, hour, minute };
}


/**
 * True when this instant is one of the digest cron ticks (12/13/14 UTC → local Eastern time)
 * and it matches the user's digest weekday and **hour** in `prefs.digestTimezone`.
 * Minute is not enforced so Vercel’s “within the hour” jitter still counts as that hour.
 */
export function isUserDigestDue(now: Date, prefs: UserDigestPrefs): boolean {
  const { weekday, hour } = getZonedWeekdayHourMinute(now, prefs.digestTimezone);
  if (weekday !== prefs.digestWeekday) return false;
  return hour === prefs.digestHour;
}

/** Next digest cron instant strictly after `now` (12, 13, or 14 UTC daily). */
export function getNextCronTickAfter(now: Date, _schedule?: string): Date | null {
  return getNextDigestCronUtcAfter(now);
}

/** Next digest send instant: next 12/13 UTC tick after `now` that matches weekday + hour in the user TZ. */
export function getNextDigestWindowStart(
  now: Date,
  prefs: UserDigestPrefs,
  _schedule?: string
): Date | null {
  let t = getNextDigestCronUtcAfter(now);
  if (!t) return null;
  for (let i = 0; i < 800; i++) {
    if (isUserDigestDue(t, prefs)) return t;
    const next = getNextDigestCronUtcAfter(new Date(t.getTime() + 1));
    if (!next) return null;
    t = next;
  }
  return null;
}
