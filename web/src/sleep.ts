import type { Night, StageName, TrendRow } from "./api";

export const STAGES: { key: StageName; label: string; color: string }[] = [
  { key: "deep", label: "Deep", color: "var(--deep)" },
  { key: "light", label: "Light", color: "var(--light)" },
  { key: "rem", label: "REM", color: "var(--rem)" },
  { key: "awake", label: "Awake", color: "var(--awake)" },
];

/** 26700 -> "7h 25m"; 1500 -> "25m". */
export function hm(seconds: number | null | undefined): string {
  if (seconds == null) return "–";
  const total = Math.round(seconds / 60);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return h ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m`;
}

/** Epoch seconds -> "23:41" in the night's own timezone (Garmin gives the offset). */
export function clock(ts: number, tzOffsetMin: number): string {
  const d = new Date((ts + tzOffsetMin * 60) * 1000);
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

export interface Baseline {
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

/** Averages of the 7 nights *before* `date`, so last night is compared with your usual. */
export function baseline(rows: TrendRow[], date: string): Baseline {
  const prior = rows.filter((r) => r.date < date).slice(-7);
  return {
    nights: prior.length,
    score: mean(prior.map((r) => r.score)),
    duration_h: mean(prior.map((r) => r.duration_h)),
    hrv: mean(prior.map((r) => r.hrv_avg)),
    resting_hr: mean(prior.map((r) => r.resting_hr)),
  };
}

/** Each stage's share of the time in bed, in display order. Missing stages count as 0. */
export function stageSplit(n: Night) {
  const secs: Record<StageName, number> = {
    deep: n.deep_s ?? 0,
    light: n.light_s ?? 0,
    rem: n.rem_s ?? 0,
    awake: n.awake_s ?? 0,
  };
  const total = Object.values(secs).reduce((a, b) => a + b, 0);
  return STAGES.map((s) => ({ ...s, seconds: secs[s.key], share: total ? secs[s.key] / total : 0 }));
}

/** Trailing average over up to 7 rows (the row itself and the 6 before), like the API's. */
export function rolling7<T>(rows: T[], value: (r: T) => number | null): (number | null)[] {
  return rows.map((_, i) => mean(rows.slice(Math.max(0, i - 6), i + 1).map(value)));
}
