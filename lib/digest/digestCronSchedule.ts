/**
 * Must match `vercel.json` → crons → path `/api/cron/weekly-digest` (two entries).
 * Vercel runs cron in UTC. Two daily UTC hours so ~8:00 America/Toronto works year-round:
 * - 12:00 UTC → 8:00 EDT / 7:00 EST
 * - 13:00 UTC → 9:00 EDT / 8:00 EST
 * - 14:00 UTC → 10:00 EDT / 9:00 EST
 * `isUserDigestDue` matches the user's `digestHour` (America/Toronto) to exactly one tick.
 */
export const WEEKLY_DIGEST_CRON_SCHEDULES = ["0 12 * * *", "0 13 * * *", "0 14 * * *"] as const;

/** @deprecated Prefer WEEKLY_DIGEST_CRON_SCHEDULES; kept for single-schedule summaries. */
export const WEEKLY_DIGEST_CRON_SCHEDULE = WEEKLY_DIGEST_CRON_SCHEDULES[0];

/** Next time any weekly-digest cron fires (strictly after `now`). */
export function getNextDigestCronUtcAfter(now: Date = new Date()): Date | null {
  let best: Date | null = null;
  for (const sched of WEEKLY_DIGEST_CRON_SCHEDULES) {
    const next = getNextWeeklyDigestRunUtc(sched, now);
    if (next && (!best || next.getTime() < best.getTime())) best = next;
  }
  return best;
}

/** Milliseconds between consecutive invocations for this schedule (for UI / simulations). */
export function cronStepMilliseconds(schedule: string): number | null {
  const fields = schedule.trim().split(/\s+/);
  if (fields.length < 5) return null;
  const [minF, hourF, domF, monF, dowF] = fields;

  const everyMin = /^\*\/(\d+)$/.exec(minF);
  if (everyMin && hourF === "*" && domF === "*" && monF === "*" && dowF === "*") {
    const step = Number(everyMin[1]);
    if (!Number.isFinite(step) || step < 1) return null;
    return step * 60 * 1000;
  }

  if (domF === "*" && monF === "*" && dowF === "*" && /^\d+$/.test(minF) && /^\d+$/.test(hourF)) {
    return 24 * 60 * 60 * 1000;
  }

  if (
    domF === "*" &&
    monF === "*" &&
    /^\d+$/.test(minF) &&
    /^\d+$/.test(hourF) &&
    /^\d+$/.test(dowF)
  ) {
    return 7 * 24 * 60 * 60 * 1000;
  }

  return null;
}

/** Next UTC instant the digest cron is expected to fire, or null if the expression is unsupported here. */
export function getNextWeeklyDigestRunUtc(
  schedule: string = WEEKLY_DIGEST_CRON_SCHEDULE,
  now: Date = new Date()
): Date | null {
  const fields = schedule.trim().split(/\s+/);
  if (fields.length < 5) return null;

  const [minF, hourF, domF, monF, dowF] = fields;

  const everyMin = /^\*\/(\d+)$/.exec(minF);
  if (everyMin && hourF === "*" && domF === "*" && monF === "*" && dowF === "*") {
    const step = Number(everyMin[1]);
    if (!Number.isFinite(step) || step < 1 || step > 59) return null;
    return nextUtcStepFromMidnight(now, step);
  }

  if (domF === "*" && monF === "*" && dowF === "*" && /^\d+$/.test(minF) && /^\d+$/.test(hourF)) {
    const minute = Number(minF);
    const hour = Number(hourF);
    if (minute < 0 || minute > 59 || hour < 0 || hour > 23) return null;
    return nextDailyUtc(now, hour, minute);
  }

  if (
    domF === "*" &&
    monF === "*" &&
    /^\d+$/.test(minF) &&
    /^\d+$/.test(hourF) &&
    /^\d+$/.test(dowF)
  ) {
    const minute = Number(minF);
    const hour = Number(hourF);
    const dow = Number(dowF);
    if (minute < 0 || minute > 59 || hour < 0 || hour > 23 || dow < 0 || dow > 6) return null;
    return nextWeeklyUtc(now, dow, hour, minute);
  }

  return null;
}

function nextUtcStepFromMidnight(now: Date, stepMinutes: number): Date {
  const startOfUtcDay = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
    0,
    0,
    0,
    0
  );
  const msSince = now.getTime() - startOfUtcDay;
  const stepMs = stepMinutes * 60 * 1000;
  const nextMs = Math.floor(msSince / stepMs) * stepMs + stepMs;
  return new Date(startOfUtcDay + nextMs);
}

function nextDailyUtc(now: Date, hour: number, minute: number): Date {
  const y = now.getUTCFullYear();
  const mo = now.getUTCMonth();
  const day = now.getUTCDate();
  let candidate = new Date(Date.UTC(y, mo, day, hour, minute, 0, 0));
  if (candidate.getTime() <= now.getTime()) {
    candidate = new Date(Date.UTC(y, mo, day + 1, hour, minute, 0, 0));
  }
  return candidate;
}

function nextWeeklyUtc(now: Date, targetDow: number, hour: number, minute: number): Date {
  const result = new Date(now);
  result.setUTCHours(hour, minute, 0, 0);
  const delta = (targetDow - result.getUTCDay() + 7) % 7;
  result.setUTCDate(result.getUTCDate() + delta);
  if (result.getTime() <= now.getTime()) {
    result.setUTCDate(result.getUTCDate() + 7);
  }
  return result;
}

/** Short phrase for UI / README (UTC). */
export function summarizeWeeklyDigestCron(
  schedule: string = WEEKLY_DIGEST_CRON_SCHEDULE
): string {
  const fields = schedule.trim().split(/\s+/);
  if (fields.length < 5) return schedule;
  const [minF, hourF, domF, monF, dowF] = fields;
  const everyMin = /^\*\/(\d+)$/.exec(minF);
  if (everyMin && hourF === "*" && domF === "*" && monF === "*" && dowF === "*") {
    const n = everyMin[1];
    return `every ${n} minutes (UTC)`;
  }
  if (domF === "*" && monF === "*" && dowF === "*" && /^\d+$/.test(minF) && /^\d+$/.test(hourF)) {
    const h = Number(hourF);
    const m = Number(minF);
    const pad = (x: number) => (x < 10 ? `0${x}` : String(x));
    return `daily at ${pad(h)}:${pad(m)} UTC`;
  }
  if (
    domF === "*" &&
    monF === "*" &&
    /^\d+$/.test(minF) &&
    /^\d+$/.test(hourF) &&
    /^\d+$/.test(dowF)
  ) {
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const dow = Number(dowF);
    const h = Number(hourF);
    const m = Number(minF);
    const pad = (x: number) => (x < 10 ? `0${x}` : String(x));
    return `${days[dow] ?? "Day"} ${pad(h)}:${pad(m)} UTC`;
  }
  return schedule;
}

/** Human-readable line for UTC slots (mapped to Eastern local hours via dashboard Hour). */
export function summarizeWeeklyDigestCronSlots(): string {
  const parts = WEEKLY_DIGEST_CRON_SCHEDULES.map((s) => summarizeWeeklyDigestCron(s));
  return `${parts.join("; ")} (pick Hour 7–10 to match 12–14 UTC across EST/EDT)`;
}
