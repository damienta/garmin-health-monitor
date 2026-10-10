import type { DayRow } from "./api";

/** "2026-10-07" -> "2026-10-06". */
export const previousDate = (iso: string) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
};

const hasData = (d: DayRow) => d.steps != null || d.bb_high != null || d.stress_avg != null;

/**
 * The day to show: `target` if it has numbers, otherwise the latest earlier day that
 * does (the watch may not have synced yet). `exact` says which case it was.
 */
export function pickDay(days: DayRow[], target: string): { day: DayRow; exact: boolean } | null {
  const found = days.find((d) => d.date === target && hasData(d));
  if (found) return { day: found, exact: true };
  const earlier = days.filter((d) => d.date < target && hasData(d)).sort((a, b) => b.date.localeCompare(a.date));
  return earlier.length ? { day: earlier[0], exact: false } : null;
}

const mean = (xs: (number | null)[]) => {
  const v = xs.filter((x): x is number => x != null);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
};

/** Averages of the 7 days before `date`, to say whether a day was busier than usual. */
export function dayBaseline(days: DayRow[], date: string) {
  const prior = days.filter((d) => d.date < date).slice(-7);
  return {
    steps: mean(prior.map((d) => d.steps)),
    active_kcal: mean(prior.map((d) => d.active_kcal)),
    intensity: mean(prior.map((d) => (d.moderate_min == null && d.vigorous_min == null ? null : intensity(d)))),
    stress: mean(prior.map((d) => d.stress_avg)),
    bb_high: mean(prior.map((d) => d.bb_high)),
    resting_hr: mean(prior.map((d) => d.resting_hr)),
  };
}

/** Intensity minutes the way Garmin counts them: vigorous minutes count double. */
export const intensity = (d: DayRow) => (d.moderate_min ?? 0) + 2 * (d.vigorous_min ?? 0);
