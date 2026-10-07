import { describe, expect, it } from "vitest";
import { ago, longDate, shortDate } from "../src/format";

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

describe("ago", () => {
  it.each([
    [0.4, "just now"],
    [1, "1 hour ago"],
    [5.2, "5 hours ago"],
    [30, "1 day ago"],
    [72, "3 days ago"],
  ])("%s hours -> %s", (h, text) => {
    expect(ago(h)).toBe(text);
  });
});
