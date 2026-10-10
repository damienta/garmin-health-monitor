import type { TrendRow } from "./api";

/**
 * Early warning: are your recovery signals off compared with your own normal?
 *
 * Your "normal" is the median of up to 30 nights before the one being checked (median,
 * so one odd night doesn't move it). Two signals, both known to shift a day or two
 * before you feel run down or ill:
 * - HRV more than 15% below normal
 * - resting heart rate 3+ bpm above normal
 * Green: neither. Yellow: one. Red: both, or HRV low two nights running.
 * This is a nudge to take it easy, not a diagnosis.
 */
export type Level = "green" | "yellow" | "red" | "unknown";

export interface Recovery {
  level: Level;
  hrv: number | null;
  hrvNormal: number | null;
  rhr: number | null;
  rhrNormal: number | null;
  hrvLow: boolean;
  rhrHigh: boolean;
  hrvLowTwice: boolean;
  message: string;
}

export const HRV_DROP = 0.15;
export const RHR_RISE = 3;
const MIN_NIGHTS = 7;

const median = (xs: number[]) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

const vals = (rows: TrendRow[], pick: (r: TrendRow) => number | null) =>
  rows.map(pick).filter((v): v is number => v != null);

function normals(rows: TrendRow[], date: string) {
  const prior = rows.filter((r) => r.date < date).slice(-30);
  const hrv = vals(prior, (r) => r.hrv_avg);
  const rhr = vals(prior, (r) => r.resting_hr);
  return {
    hrv: hrv.length >= MIN_NIGHTS ? median(hrv) : null,
    rhr: rhr.length >= MIN_NIGHTS ? median(rhr) : null,
  };
}

const isHrvLow = (v: number | null, normal: number | null) => v != null && normal != null && v < normal * (1 - HRV_DROP);

export function checkRecovery(rows: TrendRow[], date: string): Recovery {
  const sorted = [...rows].sort((a, b) => a.date.localeCompare(b.date));
  const i = sorted.findIndex((r) => r.date === date);
  const night = i >= 0 ? sorted[i] : null;
  const prev = i > 0 ? sorted[i - 1] : null;
  const norm = normals(sorted, date);
  const hrv = night?.hrv_avg ?? null;
  const rhr = night?.resting_hr ?? null;
  const base = { hrv, hrvNormal: norm.hrv, rhr, rhrNormal: norm.rhr };

  if (norm.hrv == null && norm.rhr == null) {
    return {
      ...base,
      level: "unknown",
      hrvLow: false,
      rhrHigh: false,
      hrvLowTwice: false,
      message: `Needs ${MIN_NIGHTS} nights of HRV and resting heart rate to learn your normal.`,
    };
  }

  const hrvLow = isHrvLow(hrv, norm.hrv);
  const rhrHigh = rhr != null && norm.rhr != null && rhr >= norm.rhr + RHR_RISE;
  // Yesterday's HRV against its own normal, so two low nights in a row can be spotted.
  const hrvLowTwice = hrvLow && prev != null && isHrvLow(prev.hrv_avg, normals(sorted, prev.date).hrv);

  const level: Level = (hrvLow && rhrHigh) || hrvLowTwice ? "red" : hrvLow || rhrHigh ? "yellow" : "green";
  const message =
    level === "green"
      ? "HRV and resting heart rate are in your normal range."
      : level === "red"
        ? hrvLowTwice && !rhrHigh
          ? "HRV has been low two nights running. Your body may be fighting something or under strain: go easy today."
          : "HRV is down and resting heart rate is up. That pattern often shows up before illness or after overdoing it: go easy today."
        : hrvLow
          ? "HRV is lower than normal. Could be a hard workout, alcohol, stress or a bug coming: keep an eye on it."
          : "Resting heart rate is higher than normal. Could be a hard workout, alcohol, stress or a bug coming: keep an eye on it.";
  return { ...base, level, hrvLow, rhrHigh, hrvLowTwice, message };
}
