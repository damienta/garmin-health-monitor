import { describe, expect, it } from "vitest";
import { padDates, toWeeks, weekStart } from "../src/series";

type R = { date: string; v: number | null; avg: number | null };
const r = (date: string, v: number | null): R => ({ date, v, avg: 1 });

describe("padDates", () => {
  it("fills missing days so every chart spans the same dates", () => {
    const out = padDates([r("2026-10-02", 5)], "2026-10-01", "2026-10-03", (date) => ({ date, v: null, avg: null }));
    expect(out.map((x) => [x.date, x.v])).toEqual([
      ["2026-10-01", null],
      ["2026-10-02", 5],
      ["2026-10-03", null],
    ]);
  });
});

describe("weeks", () => {
  it("finds the Monday", () => {
    expect(weekStart("2026-10-11")).toBe("2026-10-05"); // Sunday
    expect(weekStart("2026-10-05")).toBe("2026-10-05"); // Monday
  });

  it("averages each week and ignores gaps", () => {
    const out = toWeeks([r("2026-10-05", 4), r("2026-10-06", null), r("2026-10-07", 8), r("2026-10-12", 1)], ["avg"]);
    expect(out).toEqual([
      { date: "2026-10-05", v: 6, avg: null },
      { date: "2026-10-12", v: 1, avg: null },
    ]);
  });
});
