import { describe, expect, it } from "vitest";
import { niceRange } from "../src/charts/scale";
import { longDate, shortDate } from "../src/format";

describe("shortDate", () => {
  it("formats an ISO date as day and month", () => {
    expect(shortDate("2026-10-06")).toBe("6 Oct");
    expect(shortDate("2026-01-31")).toBe("31 Jan");
  });
});

describe("longDate", () => {
  it("adds the weekday", () => {
    expect(longDate("2026-10-06")).toBe("Tue 6 Oct");
  });
});

describe("niceRange", () => {
  it("pads and snaps to round ticks", () => {
    expect(niceRange([48, 52, 55])).toEqual({ domain: [45, 60], ticks: [45, 50, 55, 60] });
    expect(niceRange([31, 62])).toEqual({ domain: [20, 70], ticks: [20, 30, 40, 50, 60, 70] });
    expect(niceRange([null])).toEqual({ domain: [0, 10], ticks: [0, 5, 10] });
  });
});
