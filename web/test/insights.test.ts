import { describe, expect, it } from "vitest";
import type { ActivityRow, DayRow, TrendRow } from "../src/api";
import { loadVsHrv, sleepDebt, whatHelps } from "../src/insights";

const date = (i: number) => new Date(Date.UTC(2026, 8, 1 + i)).toISOString().slice(0, 10);
const night = (i: number, o: Partial<TrendRow> = {}): TrendRow => ({
  date: date(i),
  time: 0,
  score: 75,
  score_7d: null,
  duration_h: 7,
  duration_h_7d: null,
  hrv_avg: 50,
  hrv_7d: null,
  resting_hr: 50,
  bedtime_min: 0,
  ...o,
});
const day = (i: number, o: Partial<DayRow> = {}) => ({ date: date(i), steps: 8000, stress_avg: 30, ...o }) as DayRow;
const act = (i: number, load: number) => ({ id: i, date: date(i), training_load: load }) as ActivityRow;

// 20 nights. Even days are busy (12k steps, a workout, calm), and the nights after
// them (odd nights) score 85 and fall asleep earlier. The rest score 70.
const N = 20;
const nights = Array.from({ length: N }, (_, i) =>
  night(i, i % 2 ? { score: 85, bedtime_min: -30, hrv_avg: 45 } : { score: 70, bedtime_min: 30, hrv_avg: 55 }),
);
const days = Array.from({ length: N }, (_, i) => day(i, i % 2 ? { steps: 4000, stress_avg: 45 } : { steps: 12000, stress_avg: 20 }));
const acts = Array.from({ length: N }, (_, i) => i).filter((i) => i % 2 === 0).map((i) => act(i, 120));

describe("whatHelps", () => {
  const out = whatHelps(nights, days, acts);

  it("compares the night after each kind of day", () => {
    const steps = out.find((c) => c.factor === "Steps")!;
    expect(steps.a.score).toBe(85);
    expect(steps.b.score).toBe(70);
    expect(steps.diff).toBe(15);
    expect(out.find((c) => c.factor === "Exercise")!.a.label).toBe("workout days");
    expect(out.find((c) => c.factor === "Stress")!.diff).toBe(15);
    expect(out.find((c) => c.factor === "Bedtime")!.a.label).toMatch(/^asleep by /);
  });

  it("stays quiet without enough nights on both sides", () => {
    expect(whatHelps(nights.slice(0, 6), days.slice(0, 6), acts)).toEqual([]);
  });

  it("skips exercise when no workouts are synced", () => {
    expect(whatHelps(nights, days, []).some((c) => c.factor === "Exercise")).toBe(false);
  });
});

describe("sleepDebt", () => {
  it("adds up shortfalls against your median night over 7 nights", () => {
    const rows = [7, 7, 6, 6, 8, 7, 7, 7].map((h, i) => night(i, { duration_h: h }));
    const { usual_h, rows: out } = sleepDebt(rows);
    expect(usual_h).toBe(7);
    expect(out[2].diff_h).toBe(-1);
    expect(out[3].debt_7d).toBe(-2);
    expect(out[4].debt_7d).toBe(-1);
    expect(out[7].debt_7d).toBe(-1); // nights 1..7
  });
});

describe("loadVsHrv", () => {
  it("pairs HRV with the load of the day before", () => {
    const r = loadVsHrv(nights, acts);
    expect(r.points[1]).toEqual({ date: date(1), load: 120, hrv: 45 });
    expect(r.afterHard).toBe(45);
    expect(r.afterRest).toBe(55);
  });
});
