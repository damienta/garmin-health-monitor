import { describe, expect, it } from "vitest";
import type { DayRow, TrendRow } from "../src/api";
import { addDays } from "../src/series";
import { weeklyReport, weekStats } from "../src/weekly";

// Mon 5 Oct 2026 is the week under test; the 4 weeks before it are steady history.
const MON = "2026-10-05";
const night = (date: string, o: Partial<TrendRow> = {}): TrendRow => ({
  date,
  time: 0,
  score: 75,
  score_7d: null,
  duration_h: 7,
  duration_h_7d: null,
  hrv_avg: 50,
  hrv_7d: null,
  resting_hr: 50,
  bedtime_min: -30,
  ...o,
});
const day = (date: string, o: Partial<DayRow> = {}) => ({ date, steps: 8000, stress_avg: 30, bb_high: 80, ...o }) as DayRow;
const history = Array.from({ length: 28 }, (_, i) => night(addDays(MON, -28 + i)));
const histDays = Array.from({ length: 28 }, (_, i) => day(addDays(MON, -28 + i)));

describe("weekStats", () => {
  it("averages nights and days", () => {
    const s = weekStats([night("a", { score: 70 }), night("b", { score: 80, bedtime_min: 30 })], [day("a", { steps: 4000 }), day("b")]);
    expect(s).toMatchObject({ nights: 2, score: 75, bedtime: 0, bedtime_spread: 30, steps: 6000 });
  });
});

describe("weeklyReport", () => {
  it("compares the week with last week and the 4 weeks before", () => {
    const week = Array.from({ length: 7 }, (_, i) => night(addDays(MON, i), { score: 82, duration_h: 7.5, hrv_avg: 56 }));
    const r = weeklyReport([...history, ...week], [...histDays, ...week.map((n) => day(n.date, { steps: 9500 }))], MON, addDays(MON, 6));
    expect(r.complete).toBe(true);
    expect(r.week).toMatchObject({ nights: 7, score: 82, duration_h: 7.5 });
    expect(r.lastWeek.score).toBe(75);
    expect(r.fourWeeks.hrv).toBe(50);
    expect(r.debt_h).toBeCloseTo(3.5);
    expect(r.verdict).toBe("A solid week: average score 82, 7 up on last week.");
    expect(r.wins).toEqual([
      "Sleep score up 7 on last week.",
      "30m more sleep a night than last week.",
      "HRV 6 ms above your 4-week average: you're well recovered.",
    ]);
    expect(r.watchOuts).toEqual([]);
    expect(r.focus).toEqual(["Keep the same routine: it's working."]);
    expect(r.nightByNight.map((c) => c.weekday)).toEqual(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]);
  });

  it("flags late, short, uneven weeks and suggests a bedtime", () => {
    // Late nights all week, and much later at the weekend (Fri and Sat evenings = Sat and Sun mornings).
    const week = Array.from({ length: 7 }, (_, i) =>
      night(addDays(MON, i), { score: 65, duration_h: 6, bedtime_min: i >= 5 ? 180 : 75 }),
    );
    const r = weeklyReport([...history, ...week], [...histDays, ...week.map((n) => day(n.date, { steps: 3000 }))], MON, addDays(MON, 6));
    expect(r.watchOuts).toEqual([
      "Asleep after 01:00 on 7 nights.",
      "Sleep debt of 7h 00m against your usual.",
      "Sleep score down 10 on last week.",
    ]);
    expect(r.weekdayVsWeekend.shift_min).toBe(105);
    expect(r.focus[0]).toBe("Aim to be asleep by 23:30 on Sunday to Thursday nights.");
    expect(r.focus).toContain("Pay back the 7h 00m debt: two earlier nights at the start of the week cover most of it.");
    expect(r.focus).toHaveLength(3);
  });

  it("marks a week in progress and handles an empty week", () => {
    const r = weeklyReport([...history, night(MON)], histDays, MON, MON);
    expect(r.complete).toBe(false);
    expect(r.week.nights).toBe(1);
    expect(weeklyReport(history, histDays, addDays(MON, 7), MON).verdict).toBe("No nights recorded this week.");
  });
});
