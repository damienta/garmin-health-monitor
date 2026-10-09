import { describe, expect, it } from "vitest";
import type { DayRow, NightRow } from "../src/api";
import { computeRecords } from "../src/records";

const n = (date: string, score: number | null, duration_h = 7): NightRow =>
  ({ date, score, duration_s: duration_h * 3600 }) as NightRow;

describe("computeRecords", () => {
  const nights = [
    n("2026-10-01", 82),
    n("2026-10-02", 85, 8.5),
    n("2026-10-03", 79),
    n("2026-10-04", 81),
    n("2026-10-05", 90),
    n("2026-10-06", 84),
    // 10-07 missing: the streak ends
    n("2026-10-08", 88),
    n("2026-10-09", 60, 5),
  ];

  it("finds best, worst and longest nights with their dates", () => {
    const r = computeRecords(nights);
    expect(r.best?.date).toBe("2026-10-05");
    expect(r.worst).toMatchObject({ date: "2026-10-09", score: 60 });
    expect(r.longest?.date).toBe("2026-10-02");
    expect(r.nights).toBe(8);
    expect(r.first).toBe("2026-10-01");
    expect(r.avgScore).toBeCloseTo(81.125);
  });

  it("counts streaks of 80+ over consecutive calendar days", () => {
    const r = computeRecords(nights);
    expect(r.bestStreak).toBe(3); // 10-04, 10-05, 10-06
    expect(r.streak).toBe(0); // the latest night (60) broke it
    expect(computeRecords(nights.slice(0, 7)).streak).toBe(1); // 10-08 alone after the gap
  });

  it("ignores nights without a score and handles no data", () => {
    expect(computeRecords([n("2026-10-01", null)]).best).toBeNull();
    const empty = computeRecords([]);
    expect(empty).toMatchObject({ nights: 0, best: null, avgScore: null, streak: 0, bestStreak: 0 });
  });

  it("picks the day with the most steps", () => {
    const days = [{ date: "2026-10-01", steps: 9000 }, { date: "2026-10-02", steps: 15000 }, { date: "2026-10-03", steps: null }];
    expect(computeRecords(nights, days as DayRow[]).mostSteps?.date).toBe("2026-10-02");
  });
});
