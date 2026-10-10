import { describe, expect, it } from "vitest";
import type { DayRow } from "../src/api";
import { dayBaseline, intensity, pickDay, previousDate } from "../src/day";

const d = (date: string, o: Partial<DayRow> = {}) => ({ date, steps: 8000, stress_avg: 30, bb_high: 80, ...o }) as DayRow;

describe("pickDay", () => {
  it("uses the exact day when it has data", () => {
    expect(pickDay([d("2026-10-08"), d("2026-10-09")], "2026-10-09")).toMatchObject({ exact: true, day: { date: "2026-10-09" } });
  });

  it("falls back to the latest earlier day with numbers", () => {
    const empty = d("2026-10-09", { steps: null, stress_avg: null, bb_high: null });
    expect(pickDay([d("2026-10-07"), d("2026-10-08"), empty], "2026-10-09")).toMatchObject({
      exact: false,
      day: { date: "2026-10-08" },
    });
    expect(pickDay([], "2026-10-09")).toBeNull();
  });
});

describe("day helpers", () => {
  it("steps back a day across months", () => expect(previousDate("2026-10-01")).toBe("2026-09-30"));
  it("counts vigorous minutes double", () => expect(intensity(d("x", { moderate_min: 20, vigorous_min: 10 }))).toBe(40));
  it("averages the days before", () => {
    const b = dayBaseline([d("2026-10-07", { steps: 6000 }), d("2026-10-08", { steps: 10000 }), d("2026-10-09", { steps: 1 })], "2026-10-09");
    expect(b.steps).toBe(8000);
  });
});
