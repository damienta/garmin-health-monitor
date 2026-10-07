import { describe, expect, it } from "vitest";
import type { Night, TrendRow } from "../src/api";
import { baseline, clock, hm, stageSplit } from "../src/sleep";

const row = (date: string, score: number, extra: Partial<TrendRow> = {}): TrendRow => ({
  date,
  time: 0,
  score,
  score_7d: null,
  duration_h: 7,
  duration_h_7d: null,
  hrv_avg: 40,
  hrv_7d: null,
  resting_hr: 50,
  bedtime_min: null,
  ...extra,
});

describe("hm", () => {
  it.each([
    [26700, "7h 25m"],
    [1500, "25m"],
    [3600, "1h 00m"],
    [null, "–"],
  ])("%s -> %s", (s, text) => expect(hm(s)).toBe(text));
});

describe("clock", () => {
  it("shows local time using the night's offset", () => {
    // 2026-10-05 22:41 UTC is 23:41 in the UK in summer (+60).
    expect(clock(Date.UTC(2026, 9, 5, 22, 41) / 1000, 60)).toBe("23:41");
    expect(clock(Date.UTC(2026, 9, 5, 22, 41) / 1000, 0)).toBe("22:41");
  });
});

describe("baseline", () => {
  it("averages the 7 nights before the date, not including it", () => {
    const rows = [
      row("2026-09-28", 10), // too old: 8 nights back
      ...["29", "30"].map((d) => row(`2026-09-${d}`, 70)),
      ...["01", "02", "03", "04", "05"].map((d) => row(`2026-10-${d}`, 80)),
      row("2026-10-06", 99), // the night itself
    ];
    const b = baseline(rows, "2026-10-06");
    expect(b.nights).toBe(7);
    expect(b.score).toBeCloseTo((2 * 70 + 5 * 80) / 7);
    expect(b.duration_h).toBe(7);
  });

  it("ignores missing values and copes with no history", () => {
    expect(baseline([row("2026-10-05", 80, { hrv_avg: null })], "2026-10-06").hrv).toBeNull();
    expect(baseline([], "2026-10-06").score).toBeNull();
  });
});

describe("stageSplit", () => {
  it("gives each stage its share, in display order", () => {
    const night = { deep_s: 3600, light_s: 7200, rem_s: 3600, awake_s: null } as Night;
    expect(stageSplit(night).map((s) => [s.key, s.share])).toEqual([
      ["deep", 0.25],
      ["light", 0.5],
      ["rem", 0.25],
      ["awake", 0],
    ]);
  });
});
