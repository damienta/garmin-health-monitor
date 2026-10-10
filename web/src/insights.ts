import type { ActivityRow, DayRow, TrendRow } from "./api";
import { previousDate } from "./day";

/**
 * Insights that line each night up with the day before it (a night is dated by the
 * morning you woke, so night D follows day D-1). All simple averages, no AI.
 */

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/** Daily training load: the sum over that day's workouts. */
export function loadByDay(activities: ActivityRow[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const a of activities) out.set(a.date, (out.get(a.date) ?? 0) + (a.training_load ?? 0));
  return out;
}

// ---------- what helps your sleep ----------

/** Each group needs this many nights before we compare, so one odd night can't decide. */
export const MIN_GROUP = 5;

export interface Comparison {
  factor: string;
  a: { label: string; score: number; nights: number };
  b: { label: string; score: number; nights: number };
  /** a.score - b.score */
  diff: number;
}

interface Pair {
  night: TrendRow;
  day: DayRow | null;
  load: number;
}

function pairs(nights: TrendRow[], days: DayRow[], activities: ActivityRow[]): Pair[] {
  const byDate = new Map(days.map((d) => [d.date, d]));
  const load = loadByDay(activities);
  return nights
    .filter((n) => n.score != null)
    .map((n) => {
      const prev = previousDate(n.date);
      return { night: n, day: byDate.get(prev) ?? null, load: load.get(prev) ?? 0 };
    });
}

function compare(
  factor: string,
  ps: Pair[],
  inA: (p: Pair) => boolean | null,
  labels: [string, string],
): Comparison | null {
  const a: number[] = [];
  const b: number[] = [];
  for (const p of ps) {
    const side = inA(p);
    if (side == null) continue;
    (side ? a : b).push(p.night.score!);
  }
  if (a.length < MIN_GROUP || b.length < MIN_GROUP) return null;
  const sa = avg(a)!;
  const sb = avg(b)!;
  return {
    factor,
    a: { label: labels[0], score: sa, nights: a.length },
    b: { label: labels[1], score: sb, nights: b.length },
    diff: sa - sb,
  };
}

const roundTo = (x: number, step: number) => Math.round(x / step) * step;

/**
 * Sleep score after different kinds of day. Splits use your own median, so "high steps"
 * means high for you. Sorted by how big the difference is.
 */
export function whatHelps(nights: TrendRow[], days: DayRow[], activities: ActivityRow[]): Comparison[] {
  const ps = pairs(nights, days, activities);
  const out: (Comparison | null)[] = [];

  const steps = ps.map((p) => p.day?.steps).filter((v): v is number => v != null);
  if (steps.length) {
    const cut = roundTo(median(steps), 500);
    out.push(
      compare("Steps", ps, (p) => (p.day?.steps == null ? null : p.day.steps >= cut), [
        `${cut.toLocaleString("en-GB")}+ steps`,
        "fewer steps",
      ]),
    );
  }

  // Only meaningful if workouts are being synced at all.
  if (activities.length) out.push(compare("Exercise", ps, (p) => p.load > 0, ["workout days", "rest days"]));

  const stress = ps.map((p) => p.day?.stress_avg).filter((v): v is number => v != null);
  if (stress.length) {
    const cut = Math.round(median(stress));
    out.push(
      compare("Stress", ps, (p) => (p.day?.stress_avg == null ? null : p.day.stress_avg <= cut), [
        `calm days (stress ${cut} or under)`,
        "stressful days",
      ]),
    );
  }

  const beds = ps.map((p) => p.night.bedtime_min).filter((v): v is number => v != null);
  if (beds.length) {
    const cut = roundTo(median(beds), 15);
    out.push(
      compare("Bedtime", ps, (p) => (p.night.bedtime_min == null ? null : p.night.bedtime_min <= cut), [
        `asleep by ${clockOf(cut)}`,
        `asleep after ${clockOf(cut)}`,
      ]),
    );
  }

  return out.filter((c): c is Comparison => c != null).sort((x, y) => Math.abs(y.diff) - Math.abs(x.diff));
}

const clockOf = (m: number) => {
  const t = ((m % 1440) + 1440) % 1440;
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
};

// ---------- sleep debt ----------

export interface DebtRow {
  date: string;
  /** Hours slept minus your usual (negative = short). */
  diff_h: number | null;
  /** Running total of diff_h over this night and the 6 before. */
  debt_7d: number | null;
}

/**
 * Sleep debt against your own usual (the median night across the rows given). A single
 * short night is normal; a run of them adds up, and the 7-night total shows that.
 */
export function sleepDebt(rows: TrendRow[]): { usual_h: number | null; rows: DebtRow[] } {
  const hours = rows.map((r) => r.duration_h).filter((v): v is number => v != null);
  if (!hours.length) return { usual_h: null, rows: rows.map((r) => ({ date: r.date, diff_h: null, debt_7d: null })) };
  const usual = median(hours);
  const diffs = rows.map((r) => (r.duration_h == null ? null : r.duration_h - usual));
  return {
    usual_h: usual,
    rows: rows.map((r, i) => {
      const win = diffs.slice(Math.max(0, i - 6), i + 1).filter((v): v is number => v != null);
      return { date: r.date, diff_h: diffs[i], debt_7d: win.length ? win.reduce((a, b) => a + b, 0) : null };
    }),
  };
}

// ---------- training load vs HRV ----------

export interface LoadPoint {
  date: string;
  load: number;
  hrv: number;
}

/** Each night's HRV against the training load of the day before (0 on rest days). */
export function loadVsHrv(nights: TrendRow[], activities: ActivityRow[]) {
  const load = loadByDay(activities);
  const points: LoadPoint[] = nights
    .filter((n) => n.hrv_avg != null)
    .map((n) => ({ date: n.date, load: load.get(previousDate(n.date)) ?? 0, hrv: n.hrv_avg! }));
  const hard = points.filter((p) => p.load > 0).map((p) => p.load);
  const cut = hard.length ? median(hard) : null;
  const hardHrv = cut == null ? [] : points.filter((p) => p.load >= cut).map((p) => p.hrv);
  const restHrv = points.filter((p) => p.load === 0).map((p) => p.hrv);
  return {
    points,
    /** Median load of training days: at or above it counts as a hard day. */
    hardCut: cut,
    afterHard: hardHrv.length >= MIN_GROUP ? avg(hardHrv) : null,
    afterRest: restHrv.length >= MIN_GROUP ? avg(restHrv) : null,
  };
}
