import { describe, expect, it } from "vitest";
import type { TrendRow } from "../src/api";
import { checkRecovery } from "../src/recovery";

// 20 steady nights (HRV 50, resting HR 50) from 1 Sep, then the nights under test.
const row = (date: string, hrv: number | null, rhr: number | null): TrendRow => ({
  date,
  time: 0,
  score: 80,
  score_7d: 80,
  duration_h: 7,
  duration_h_7d: 7,
  hrv_avg: hrv,
  hrv_7d: null,
  resting_hr: rhr,
  bedtime_min: 0,
});
const steady = Array.from({ length: 20 }, (_, i) => row(`2026-09-${String(i + 1).padStart(2, "0")}`, 50, 50));
const withNights = (...xs: [number | null, number | null][]) =>
  steady.concat(xs.map(([h, r], i) => row(`2026-09-${21 + i}`, h, r)));

describe("checkRecovery", () => {
  it("is green when both signals are normal", () => {
    expect(checkRecovery(withNights([49, 51]), "2026-09-21").level).toBe("green");
  });

  it("is yellow when one signal is off", () => {
    const low = checkRecovery(withNights([40, 50]), "2026-09-21");
    expect(low).toMatchObject({ level: "yellow", hrvLow: true, rhrHigh: false, hrvNormal: 50 });
    expect(checkRecovery(withNights([50, 53]), "2026-09-21")).toMatchObject({ level: "yellow", rhrHigh: true });
  });

  it("is red when both are off", () => {
    expect(checkRecovery(withNights([40, 54]), "2026-09-21").level).toBe("red");
  });

  it("is red when HRV is low two nights running", () => {
    const r = checkRecovery(withNights([41, 50], [40, 50]), "2026-09-22");
    expect(r).toMatchObject({ level: "red", hrvLowTwice: true });
  });

  it("needs a week of history first", () => {
    const short = steady.slice(0, 3).concat(row("2026-09-04", 30, 70));
    expect(checkRecovery(short, "2026-09-04").level).toBe("unknown");
  });

  it("ignores a missing value instead of guessing", () => {
    expect(checkRecovery(withNights([null, 50]), "2026-09-21").level).toBe("green");
  });
});
