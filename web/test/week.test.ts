import { describe, expect, it } from "vitest";
import type { Night, TrendRow } from "../src/api";
import { bedtimeMin, type Baseline } from "../src/sleep";
import { headline } from "../src/summary";
import { weekCompare } from "../src/week";

const row = (date: string, score: number): TrendRow => ({
  date,
  time: 0,
  score,
  score_7d: null,
  duration_h: 7,
  duration_h_7d: null,
  hrv_avg: 50,
  hrv_7d: null,
  resting_hr: 50,
  bedtime_min: 0,
});

describe("weekCompare", () => {
  it("splits by calendar week ending on the date", () => {
    // 1..14 Oct: first week scores 70, second week 80. 15 Oct is outside.
    const rows = Array.from({ length: 15 }, (_, i) => row(`2026-10-${String(i + 1).padStart(2, "0")}`, i < 7 ? 70 : i < 14 ? 80 : 99));
    const { thisWeek, lastWeek } = weekCompare(rows, "2026-10-14");
    expect(thisWeek).toMatchObject({ nights: 7, score: 80 });
    expect(lastWeek).toMatchObject({ nights: 7, score: 70 });
  });

  it("counts only the nights that exist", () => {
    const { thisWeek, lastWeek } = weekCompare([row("2026-10-10", 80), row("2026-10-02", 60)], "2026-10-10");
    expect(thisWeek.nights).toBe(1);
    expect(lastWeek).toMatchObject({ nights: 1, score: 60 });
  });
});

// 23:29 -> 07:46 local (+60).
const night = (o: Partial<Night> = {}): Night => ({
  date: "2026-10-07",
  start_ts: Date.UTC(2026, 9, 6, 22, 29) / 1000,
  end_ts: Date.UTC(2026, 9, 7, 6, 46) / 1000,
  tz_offset_min: 60,
  duration_s: 7.5 * 3600,
  deep_s: 5400,
  light_s: 14000,
  rem_s: 6000,
  awake_s: 600,
  score: 82,
  resting_hr: 50,
  hrv_avg: 50,
  stages: [],
  ...o,
});
const usual: Baseline = { nights: 7, score: 78, duration_h: 7.4, hrv: 50, resting_hr: 50, bedtime: -20 };

describe("bedtimeMin", () => {
  it("matches the API: 23:29 is -31, 00:45 is 45", () => {
    expect(bedtimeMin(night())).toBe(-31);
    expect(bedtimeMin(night({ start_ts: Date.UTC(2026, 9, 6, 23, 45) / 1000 }))).toBe(45);
  });
});

describe("headline", () => {
  it("grades the night and notes a short one", () => {
    expect(headline(night(), usual)).toBe("A good night.");
    expect(headline(night({ score: 90 }), usual)).toBe("A great night.");
    expect(headline(night({ score: 78, duration_s: 6 * 3600 }), usual)).toBe("A good night, if a bit short.");
    expect(headline(night({ score: 50 }), usual)).toBe("A poor night.");
  });
});
