import type { DayRow, NightRow } from "./api";

export interface Records {
  nights: number;
  first: string | null;
  best: NightRow | null;
  worst: NightRow | null;
  longest: NightRow | null;
  avgScore: number | null;
  avgDuration: number | null; // seconds
  streak: number; // nights in a row ending at the latest night with score >= STREAK_SCORE
  bestStreak: number;
  mostSteps: DayRow | null;
}

export const STREAK_SCORE = 80;

const nextDay = (iso: string) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
};

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

/**
 * Personal bests from every night you have. A streak counts nights in a row (calendar
 * days, no gaps) scoring 80 or more; a missing night ends it.
 */
export function computeRecords(nights: NightRow[], days: DayRow[] = []): Records {
  const sorted = [...nights].sort((a, b) => a.date.localeCompare(b.date));
  const scored = sorted.filter((n) => n.score != null);
  const byScore = [...scored].sort((a, b) => b.score! - a.score! || a.date.localeCompare(b.date));

  let run = 0;
  let bestStreak = 0;
  let prev: string | null = null;
  for (const n of sorted) {
    const good = n.score != null && n.score >= STREAK_SCORE;
    run = good ? (prev && nextDay(prev) === n.date ? run + 1 : 1) : 0;
    bestStreak = Math.max(bestStreak, run);
    prev = n.date;
  }
  // `run` is the streak ending at the latest night (0 if that night broke it).

  const stepsDays = days.filter((d) => d.steps != null);
  return {
    nights: sorted.length,
    first: sorted[0]?.date ?? null,
    best: byScore[0] ?? null,
    worst: byScore.at(-1) ?? null,
    longest: [...sorted].sort((a, b) => b.duration_s - a.duration_s)[0] ?? null,
    avgScore: avg(scored.map((n) => n.score!)),
    avgDuration: avg(sorted.map((n) => n.duration_s)),
    streak: run,
    bestStreak,
    mostSteps: [...stepsDays].sort((a, b) => b.steps! - a.steps!)[0] ?? null,
  };
}
