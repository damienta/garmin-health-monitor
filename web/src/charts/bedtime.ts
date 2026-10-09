import type { NightRow } from "../api";

/** Minutes from local midnight -> "23:30" (negative = the evening before). */
export const minToClock = (m: number) => {
  const t = ((Math.round(m) % 1440) + 1440) % 1440;
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
};

/** Each night's bed and wake times as minutes from local midnight (bed can be negative). */
export function sleepWindows(rows: NightRow[]) {
  return rows
    .filter((r) => r.bedtime_min != null)
    .map((r) => {
      const wake = Math.round((((r.end_ts + r.tz_offset_min * 60) % 86400) + 86400) % 86400 / 60);
      return { date: r.date, bed: r.bedtime_min!, wake, window: [r.bedtime_min!, wake] as [number, number] };
    });
}

export const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const sd = (xs: number[]) => Math.sqrt(mean(xs.map((x) => (x - mean(xs)) ** 2)));

/** Bedtime spread in minutes (standard deviation): lower means a steadier routine. */
export const bedtimeSpread = (rows: NightRow[]) => {
  const beds = sleepWindows(rows).map((w) => w.bed);
  return beds.length > 1 ? Math.round(sd(beds)) : null;
};
