import type { DayRow, TrendRow } from "./api";
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
}

function pairs(nights: TrendRow[], days: DayRow[]): Pair[] {
  const byDate = new Map(days.map((d) => [d.date, d]));
  return nights.filter((n) => n.score != null).map((n) => ({ night: n, day: byDate.get(previousDate(n.date)) ?? null }));
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
export function whatHelps(nights: TrendRow[], days: DayRow[]): Comparison[] {
  const ps = pairs(nights, days);
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

// ---------- best night of the week ----------

const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export interface WeekdayRow {
  /** "Friday" means Friday night, the night you woke from on Saturday. */
  day: string;
  short: string;
  score: number | null;
  duration_h: number | null;
  nights: number;
}

/**
 * Average sleep score and time asleep for each night of the week. Named by the evening
 * you went to bed, since that's when the choices happen (a Friday night out, a Sunday
 * before work).
 */
export function byWeekday(nights: TrendRow[]): WeekdayRow[] {
  const groups = WEEKDAYS.map(() => ({ scores: [] as number[], hours: [] as number[] }));
  for (const n of nights) {
    const bedDay = (new Date(`${previousDate(n.date)}T00:00:00Z`).getUTCDay() + 6) % 7; // Monday = 0
    if (n.score != null) groups[bedDay].scores.push(n.score);
    if (n.duration_h != null) groups[bedDay].hours.push(n.duration_h);
  }
  return groups.map((g, i) => ({
    day: WEEKDAYS[i],
    short: WEEKDAYS[i].slice(0, 3),
    score: avg(g.scores),
    duration_h: avg(g.hours),
    nights: g.scores.length,
  }));
}
