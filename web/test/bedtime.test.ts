import { describe, expect, it } from "vitest";
import type { NightRow } from "../src/api";
import { bedtimeSpread, minToClock, sleepWindows } from "../src/charts/bedtime";

// Fell asleep 23:30 local (bedtime_min -30), woke 07:15 local, in BST (+60).
const night = (date: string, bed: number, wakeUtc: [number, number]): NightRow =>
  ({ date, bedtime_min: bed, tz_offset_min: 60, end_ts: Date.UTC(2026, 9, 7, ...wakeUtc) / 1000 }) as NightRow;

describe("bedtime helpers", () => {
  it("formats minutes from midnight as a clock", () => {
    expect(minToClock(-30)).toBe("23:30");
    expect(minToClock(435)).toBe("07:15");
    expect(minToClock(0)).toBe("00:00");
  });

  it("turns nights into bed/wake windows in local time", () => {
    expect(sleepWindows([night("2026-10-07", -30, [6, 15])])).toEqual([
      { date: "2026-10-07", bed: -30, wake: 435, window: [-30, 435] },
    ]);
  });

  it("measures how much bedtime varies", () => {
    const rows = [night("a", -60, [6, 0]), night("b", 0, [6, 0])];
    expect(bedtimeSpread(rows)).toBe(30);
    expect(bedtimeSpread(rows.slice(0, 1))).toBeNull();
  });
});
