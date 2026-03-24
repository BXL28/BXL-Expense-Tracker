/**
 * Must match `vercel.json` → crons → path `/api/cron/weekly-digest` → schedule.
 * Vercel runs cron in UTC.
 */
export const WEEKLY_DIGEST_CRON_SCHEDULE = "*/15 * * * *";

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
