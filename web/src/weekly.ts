import type { DayRow, TrendRow } from "./api";
import { minToClock } from "./charts/bedtime";
import { previousDate } from "./day";
import { checkRecovery, type Level } from "./recovery";
import { addDays } from "./series";
import { hm } from "./sleep";

/**
 * The weekly review: averages for one Monday-to-Sunday week, compared with the week
 * before and with the 4 weeks before it, plus simple rules for wins, watch-outs and
 * next week's focus. A night belongs to the week of the morning you woke up.
 */

export interface WeekStats {
  nights: number;
  score: number | null;
  duration_h: number | null;
  /** Average bedtime, minutes from midnight (23:30 is -30). */
  bedtime: number | null;
  /** How much bedtime varied (standard deviation, minutes). */
  bedtime_spread: number | null;
  hrv: number | null;
  resting_hr: number | null;
  steps: number | null;
  stress: number | null;
  bb_high: number | null;
}

export interface NightCell {
  date: string;
  weekday: string;
  score: number | null;
  duration_h: number | null;
  bedtime: number | null;
  recovery: Level | null;
}

export interface WeeklyReport {
  monday: string;
  sunday: string;
  /** False while the week is still going. */
  complete: boolean;
  week: WeekStats;
  lastWeek: WeekStats;
  fourWeeks: WeekStats;
  /** Hours slept minus your usual (median of the 28 nights before), summed over the week. */
  debt_h: number | null;
  nightByNight: NightCell[];
  recovery: Record<"green" | "yellow" | "red", number>;
  best: NightCell | null;
  worst: NightCell | null;
  weekdayVsWeekend: { weekday: SideStats; weekend: SideStats; shift_min: number | null };
  verdict: string;
  wins: string[];
  watchOuts: string[];
  focus: string[];
}

interface SideStats {
  nights: number;
  bedtime: number | null;
  duration_h: number | null;
  score: number | null;
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const nums = (xs: (number | null | undefined)[]) => xs.filter((x): x is number => x != null);
const avg = (xs: (number | null | undefined)[]) => {
  const v = nums(xs);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
};
const median = (xs: number[]) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const sd = (xs: number[]) => {
  if (xs.length < 2) return null;
  const m = xs.reduce((a, b) => a + b, 0) / xs.length;
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length);
};
const inRange = <T extends { date: string }>(rows: T[], from: string, to: string) =>
  rows.filter((r) => r.date >= from && r.date <= to);

export function weekStats(nights: TrendRow[], days: DayRow[]): WeekStats {
  const beds = nums(nights.map((n) => n.bedtime_min));
  return {
    nights: nights.length,
    score: avg(nights.map((n) => n.score)),
    duration_h: avg(nights.map((n) => n.duration_h)),
    bedtime: avg(beds),
    bedtime_spread: sd(beds),
    hrv: avg(nights.map((n) => n.hrv_avg)),
    resting_hr: avg(nights.map((n) => n.resting_hr)),
    steps: avg(days.map((d) => d.steps)),
    stress: avg(days.map((d) => d.stress_avg)),
    bb_high: avg(days.map((d) => d.bb_high)),
  };
}

/** Bedtime evening of a night (dated by wake-up): 0 = Monday ... 6 = Sunday. */
const bedWeekday = (date: string) => (new Date(`${previousDate(date)}T00:00:00Z`).getUTCDay() + 6) % 7;

const sideStats = (rows: TrendRow[]): SideStats => ({
  nights: rows.length,
  bedtime: avg(rows.map((r) => r.bedtime_min)),
  duration_h: avg(rows.map((r) => r.duration_h)),
  score: avg(rows.map((r) => r.score)),
});

const floor15 = (m: number) => Math.floor(m / 15) * 15;
/** "+1h 20m" / "−45m". */
export const signedHm = (h: number) => `${h < 0 ? "−" : "+"}${hm(Math.abs(h) * 3600)}`;

/**
 * Build the report for the week starting `monday`. `latest` is the newest date with data,
 * to tell a finished week from one still in progress.
 */
export function weeklyReport(trends: TrendRow[], days: DayRow[], monday: string, latest: string): WeeklyReport {
  const sunday = addDays(monday, 6);
  const nights = inRange(trends, monday, sunday);
  const dayRows = inRange(days, monday, sunday);
  const week = weekStats(nights, dayRows);
  const lastWeek = weekStats(inRange(trends, addDays(monday, -7), addDays(monday, -1)), inRange(days, addDays(monday, -7), addDays(monday, -1)));
  const fourWeeks = weekStats(
    inRange(trends, addDays(monday, -28), addDays(monday, -1)),
    inRange(days, addDays(monday, -28), addDays(monday, -1)),
  );

  const usual = median(nums(inRange(trends, addDays(monday, -28), addDays(monday, -1)).map((n) => n.duration_h)));
  const durations = nums(nights.map((n) => n.duration_h));
  const debt_h = usual == null || !durations.length ? null : durations.reduce((a, d) => a + (d - usual), 0);

  const byDate = new Map(nights.map((n) => [n.date, n]));
  const nightByNight: NightCell[] = WEEKDAYS.map((weekday, i) => {
    const date = addDays(monday, i);
    const n = byDate.get(date);
    const level = n ? checkRecovery(trends, date).level : null;
    return {
      date,
      weekday,
      score: n?.score ?? null,
      duration_h: n?.duration_h ?? null,
      bedtime: n?.bedtime_min ?? null,
      recovery: level,
    };
  });
  const recovery = { green: 0, yellow: 0, red: 0 };
  for (const c of nightByNight) if (c.recovery && c.recovery !== "unknown") recovery[c.recovery] += 1;

  const scored = nightByNight.filter((c) => c.score != null);
  const best = scored.length ? scored.reduce((a, b) => (b.score! > a.score! ? b : a)) : null;
  const worst = scored.length > 1 ? scored.reduce((a, b) => (b.score! < a.score! ? b : a)) : null;

  // Fri and Sat evenings are the weekend; Sun to Thu evenings are school nights.
  const weekendRows = nights.filter((n) => [4, 5].includes(bedWeekday(n.date)));
  const weekdayRows = nights.filter((n) => ![4, 5].includes(bedWeekday(n.date)));
  const weekday = sideStats(weekdayRows);
  const weekend = sideStats(weekendRows);
  const shift_min = weekday.bedtime != null && weekend.bedtime != null ? weekend.bedtime - weekday.bedtime : null;

  const report: WeeklyReport = {
    monday,
    sunday,
    complete: latest >= sunday,
    week,
    lastWeek,
    fourWeeks,
    debt_h,
    nightByNight,
    recovery,
    best,
    worst,
    weekdayVsWeekend: { weekday, weekend, shift_min },
    verdict: "",
    wins: [],
    watchOuts: [],
    focus: [],
  };
  report.verdict = verdict(report);
  report.wins = wins(report);
  report.watchOuts = watchOuts(report);
  report.focus = focus(report, dayRows);
  return report;
}

const diff = (a: number | null, b: number | null) => (a == null || b == null ? null : a - b);

function verdict(r: WeeklyReport): string {
  const s = r.week.score;
  if (s == null) return r.week.nights ? "Not enough scored nights to judge this week." : "No nights recorded this week.";
  const grade = s >= 85 ? "A great week" : s >= 75 ? "A solid week" : s >= 60 ? "An OK week" : "A rough week";
  const d = diff(s, r.lastWeek.score);
  const vs = d == null || Math.round(Math.abs(d)) === 0 ? "" : `, ${Math.round(Math.abs(d))} ${d > 0 ? "up" : "down"} on last week`;
  return `${grade}: average score ${Math.round(s)}${vs}.`;
}

function wins(r: WeeklyReport): string[] {
  const out: string[] = [];
  const { week: w, lastWeek: l, fourWeeks: f } = r;
  const ds = diff(w.score, l.score);
  if (ds != null && ds >= 3) out.push(`Sleep score up ${Math.round(ds)} on last week.`);
  const dd = diff(w.duration_h, l.duration_h);
  if (dd != null && dd >= 0.25) out.push(`${hm(dd * 3600)} more sleep a night than last week.`);
  const dh = diff(w.hrv, f.hrv);
  if (dh != null && dh >= 3) out.push(`HRV ${Math.round(dh)} ms above your 4-week average: you're well recovered.`);
  if (w.bedtime_spread != null && w.nights >= 4 && w.bedtime_spread < 30) out.push("A steady bedtime: it varied by less than half an hour.");
  if (w.nights >= 5 && r.recovery.yellow + r.recovery.red === 0 && r.recovery.green >= 5) out.push("Recovery was green every day.");
  const dst = diff(w.steps, l.steps);
  if (dst != null && dst >= 1000) out.push(`${Math.round(dst).toLocaleString("en-GB")} more steps a day than last week.`);
  return out.slice(0, 3);
}

function watchOuts(r: WeeklyReport): string[] {
  const out: string[] = [];
  const { week: w, lastWeek: l } = r;
  const late = r.nightByNight.filter((c) => c.bedtime != null && c.bedtime > 60).length;
  if (late >= 3) out.push(`Asleep after 01:00 on ${late} nights.`);
  if (r.debt_h != null && r.debt_h <= -2) out.push(`Sleep debt of ${hm(Math.abs(r.debt_h) * 3600)} against your usual.`);
  if (w.bedtime_spread != null && w.nights >= 4 && w.bedtime_spread > 60) out.push(`Bedtime swung by about ±${Math.round(w.bedtime_spread)} minutes.`);
  const off = r.recovery.yellow + r.recovery.red;
  if (off >= 2) out.push(`Recovery was off on ${off} days.`);
  const ds = diff(w.score, l.score);
  if (ds != null && ds <= -3) out.push(`Sleep score down ${Math.round(Math.abs(ds))} on last week.`);
  const shift = r.weekdayVsWeekend.shift_min;
  if (shift != null && shift >= 60) out.push(`Weekend bedtime ${hm(shift * 60)} later than weekdays (social jet lag).`);
  return out.slice(0, 3);
}

function focus(r: WeeklyReport, days: DayRow[]): string[] {
  const out: string[] = [];
  const { week: w, fourWeeks: f } = r;
  const lateWeek = (w.bedtime != null && f.bedtime != null && w.bedtime - f.bedtime >= 30) || (w.bedtime_spread ?? 0) > 45;
  if (lateWeek) {
    const base = r.weekdayVsWeekend.weekday.bedtime ?? w.bedtime ?? f.bedtime;
    const target = floor15(Math.min(base ?? 0, f.bedtime ?? base ?? 0));
    out.push(`Aim to be asleep by ${minToClock(target)} on Sunday to Thursday nights.`);
  }
  if (r.debt_h != null && r.debt_h <= -1) {
    out.push(`Pay back the ${hm(Math.abs(r.debt_h) * 3600)} debt: two earlier nights at the start of the week cover most of it.`);
  }
  const shift = r.weekdayVsWeekend.shift_min;
  if (shift != null && shift >= 60) out.push("Keep weekend bedtimes within an hour of weekdays to avoid the Monday slump.");
  const lowSteps = days.filter((d) => d.steps != null && d.steps < 5000).length;
  if (lowSteps >= 3 || (w.steps != null && w.steps < 6000)) out.push("Get a 20 to 30 minute walk in on most days, ideally in daylight.");
  if (r.recovery.yellow + r.recovery.red >= 2) out.push("Save hard training for your green days and take it easier on amber or red ones.");
  if (!out.length && w.nights) out.push("Keep the same routine: it's working.");
  return out.slice(0, 3);
}

