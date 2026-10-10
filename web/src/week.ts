import type { TrendRow } from "./api";

export interface WeekStats {
  nights: number;
  score: number | null;
  duration_h: number | null;
  hrv: number | null;
  resting_hr: number | null;
}

const mean = (xs: (number | null)[]) => {
  const v = xs.filter((x): x is number => x != null);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
};

const stats = (rows: TrendRow[]): WeekStats => ({
  nights: rows.length,
  score: mean(rows.map((r) => r.score)),
  duration_h: mean(rows.map((r) => r.duration_h)),
  hrv: mean(rows.map((r) => r.hrv_avg)),
  resting_hr: mean(rows.map((r) => r.resting_hr)),
});

/**
 * This week vs last week, by calendar days: the 7 nights ending `date` (inclusive) and
 * the 7 before them. Missing nights just count as missing, they don't shift the windows.
 */
export function weekCompare(rows: TrendRow[], date: string): { thisWeek: WeekStats; lastWeek: WeekStats } {
  const back = (n: number) => {
    const d = new Date(`${date}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() - n);
    return d.toISOString().slice(0, 10);
  };
  const thisStart = back(6);
  const lastStart = back(13);
  return {
    thisWeek: stats(rows.filter((r) => r.date >= thisStart && r.date <= date)),
    lastWeek: stats(rows.filter((r) => r.date >= lastStart && r.date < thisStart)),
  };
}
