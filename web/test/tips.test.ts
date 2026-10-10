import { describe, expect, it } from "vitest";
import type { DayRow, Night } from "../src/api";
import type { Recovery } from "../src/recovery";
import type { Baseline } from "../src/sleep";
import { headline } from "../src/summary";
import { bedtimeMin, writeTips } from "../src/tips";

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
const ok = { level: "green" } as Recovery;
const day = (o: Partial<DayRow> = {}) => ({ date: "2026-10-06", steps: 9000, stress_avg: 25, ...o }) as DayRow;

describe("bedtimeMin", () => {
  it("matches the API: 23:29 is -31, 00:45 is 45", () => {
    expect(bedtimeMin(night())).toBe(-31);
    expect(bedtimeMin(night({ start_ts: Date.UTC(2026, 9, 6, 23, 45) / 1000 }))).toBe(45);
  });
});

describe("writeTips", () => {
  it("says keep going when nothing stands out", () => {
    const tips = writeTips(night(), usual, day(), ok);
    expect(tips).toHaveLength(1);
    expect(tips[0]).toContain("Nothing to fix");
    expect(tips[0]).toContain("23:40");
  });

  it("puts a recovery warning first and caps at three", () => {
    const tips = writeTips(
      night({ duration_s: 5.5 * 3600, deep_s: 1200, awake_s: 2400, start_ts: Date.UTC(2026, 9, 7, 0, 30) / 1000 }),
      usual,
      day({ steps: 3000, stress_avg: 50 }),
      { level: "red" } as Recovery,
    );
    expect(tips).toHaveLength(3);
    expect(tips[0]).toContain("recovery signals are off");
    expect(tips[1]).toBe("You slept less than usual. Aim to be asleep by 23:00 tonight to catch up.");
  });

  it("copes with no day data", () => {
    expect(writeTips(night({ awake_s: 3600 }), usual, null, ok)[0]).toContain("cool and dark");
  });
});

describe("headline", () => {
  it("grades the night and notes a short one", () => {
    expect(headline(night(), usual, ok)).toBe("A good night.");
    expect(headline(night({ score: 90 }), usual)).toBe("A great night.");
    expect(headline(night({ score: 78, duration_s: 6 * 3600 }), usual)).toBe("A good night, if a bit short.");
    expect(headline(night({ score: 50 }), usual, { level: "red" } as Recovery)).toBe(
      "A poor night. Your body looks under strain today.",
    );
  });
});
