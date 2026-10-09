import { describe, expect, it } from "vitest";
import type { DayRow, Night } from "../src/api";
import type { Baseline } from "../src/sleep";
import { writeSummary } from "../src/summary";

// 22:29 UTC -> 06:46 UTC next morning, shown at +60 (23:29 -> 07:46).
const night = (o: Partial<Night> = {}): Night => ({
  date: "2026-10-07",
  start_ts: Date.UTC(2026, 9, 6, 22, 29) / 1000,
  end_ts: Date.UTC(2026, 9, 7, 6, 46) / 1000,
  tz_offset_min: 60,
  duration_s: 6 * 3600 + 52 * 60,
  deep_s: 5160,
  light_s: 13500,
  rem_s: 6060,
  awake_s: 1500,
  score: 81,
  resting_hr: 54,
  hrv_avg: 52,
  stages: [],
  ...o,
});
const usual: Baseline = { nights: 7, score: 75, duration_h: 7.1, hrv: 47, resting_hr: 53 };

describe("writeSummary", () => {
  it("describes a typical night against your usual", () => {
    expect(writeSummary(night(), usual)).toEqual([
      "You slept 6h 52m, 14m less than usual, from 23:29 to 07:46.",
      "Your sleep score was 81, 6 above your weekly average.",
      "You got a good amount of deep sleep (1h 26m, 20%) and 23% REM.",
      "HRV was up 5 ms on your usual.",
    ]);
  });

  it("stays short when nothing stands out", () => {
    const same = writeSummary(night({ duration_s: 7.1 * 3600, score: 76, hrv_avg: 48, resting_hr: 53 }), usual);
    expect(same[0]).toContain("about your usual");
    expect(same[1]).toBe("Your sleep score was 76, in line with your week.");
    expect(same.some((s) => s.includes("HRV"))).toBe(false);
  });

  it("flags low deep sleep, long wake time and a raised resting HR", () => {
    const s = writeSummary(night({ deep_s: 1800, awake_s: 2700, resting_hr: 58, hrv_avg: 40 }), usual);
    expect(s).toContain("You got less deep sleep than ideal (30m, 7%) and 25% REM.");
    expect(s).toContain("You were awake for 45m during the night.");
    expect(s).toContain("HRV was down 7 ms and resting heart rate was up 5 bpm on your usual.");
  });

  it("copes with no history and missing values", () => {
    const empty: Baseline = { nights: 0, score: null, duration_h: null, hrv: null, resting_hr: null };
    const s = writeSummary(night({ score: null, deep_s: null, rem_s: null }), empty);
    expect(s).toEqual(["You slept 6h 52m, from 23:29 to 07:46."]);
  });

  it("adds the day before when there is one", () => {
    const day = { steps: 9412, stress_avg: 31, bb_high: 88 } as DayRow;
    expect(writeSummary(night(), usual, day).at(-1)).toBe(
      "The day before: 9,412 steps, average stress 31, Body Battery peaking at 88.",
    );
  });
});
