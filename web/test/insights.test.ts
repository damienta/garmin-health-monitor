import { describe, expect, it } from "vitest";
import type { DayRow, TrendRow } from "../src/api";
import { byWeekday, sleepDebt, whatHelps } from "../src/insights";

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

// 20 nights. Even days are busy (12k steps, calm), and the nights after
// them (odd nights) score 85 and fall asleep earlier. The rest score 70.
const N = 20;
const nights = Array.from({ length: N }, (_, i) =>
  night(i, i % 2 ? { score: 85, bedtime_min: -30, hrv_avg: 45 } : { score: 70, bedtime_min: 30, hrv_avg: 55 }),
);
const days = Array.from({ length: N }, (_, i) => day(i, i % 2 ? { steps: 4000, stress_avg: 45 } : { steps: 12000, stress_avg: 20 }));

describe("whatHelps", () => {
  const out = whatHelps(nights, days);

  it("compares the night after each kind of day", () => {
    const steps = out.find((c) => c.factor === "Steps")!;
    expect(steps.a.score).toBe(85);
    expect(steps.b.score).toBe(70);
    expect(steps.diff).toBe(15);
    expect(out.find((c) => c.factor === "Stress")!.diff).toBe(15);
    const bed = out.find((c) => c.factor === "Bedtime")!;
    expect(bed.a.label).toMatch(/^Asleep by /);
    expect(bed.a.phrase).toMatch(/^on nights you.re asleep by /);
    expect(out.find((c) => c.factor === "Steps")!.a.phrase).toBe("after days with 12,000+ steps");
  });

  it("stays quiet without enough nights on both sides", () => {
    expect(whatHelps(nights.slice(0, 6), days.slice(0, 6))).toEqual([]);
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

describe("byWeekday", () => {
  it("names each night by the evening you went to bed", () => {
    // 2026-09-01 is a Tuesday, so the night dated 1 Sep is Monday night.
    const out = byWeekday([night(0, { score: 90 }), night(7, { score: 70 }), night(1, { score: 60 })]);
    expect(out[0]).toMatchObject({ day: "Monday", score: 80, nights: 2 });
    expect(out[1]).toMatchObject({ day: "Tuesday", score: 60, nights: 1 });
    expect(out[6]).toMatchObject({ day: "Sunday", score: null, nights: 0 });
  });
});
