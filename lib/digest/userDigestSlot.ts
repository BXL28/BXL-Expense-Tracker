import {
  cronStepMilliseconds,
  getNextWeeklyDigestRunUtc,
  WEEKLY_DIGEST_CRON_SCHEDULE,
} from "@/lib/digest/digestCronSchedule";

export type UserDigestPrefs = {
  digestWeekday: number;
  digestHour: number;
  digestMinute: number;
  digestTimezone: string;
};

export const DEFAULT_DIGEST_PREFS: UserDigestPrefs = {
  digestWeekday: 0,
  digestHour: 9,
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
  const hour = parseInt(m.hour ?? "0", 10);
  const minute = parseInt(m.minute ?? "0", 10);
  return { weekday: wd, hour, minute };
}


/**
 * True when the digest runs on this UTC instant and it is the user's digest weekday
 * in their timezone. With a single daily global cron, local hour/minute cannot be honored
 * for everyone, so only the weekday gate is used for sending.
 */
export function isUserDigestDue(now: Date, prefs: UserDigestPrefs): boolean {
  const { weekday } = getZonedWeekdayHourMinute(now, prefs.digestTimezone);
  return weekday === prefs.digestWeekday;
}

const FALLBACK_STEP_MS = 60 * 60 * 1000;

/** Next cron tick strictly after `now` (aligned to digest cron schedule). */
export function getNextCronTickAfter(
  now: Date,
  schedule: string = WEEKLY_DIGEST_CRON_SCHEDULE
): Date | null {
  let t = getNextWeeklyDigestRunUtc(schedule, now);
  if (!t) return null;
  const step = cronStepMilliseconds(schedule) ?? FALLBACK_STEP_MS;
  while (t.getTime() <= now.getTime()) {
    t = new Date(t.getTime() + step);
  }
  return t;
}

/** Next digest send instant: next cron tick after `now` that falls on the user's digest weekday (in their TZ). */
export function getNextDigestWindowStart(
  now: Date,
  prefs: UserDigestPrefs,
  schedule: string = WEEKLY_DIGEST_CRON_SCHEDULE
): Date | null {
  let t = getNextCronTickAfter(now, schedule);
  if (!t) return null;
  const step = cronStepMilliseconds(schedule) ?? FALLBACK_STEP_MS;
  for (let i = 0; i < 400; i++) {
    if (isUserDigestDue(t, prefs)) return t;
    t = new Date(t.getTime() + step);
  }
  return null;
}
