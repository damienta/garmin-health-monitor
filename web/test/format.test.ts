import { describe, expect, it } from "vitest";
import { shortDate } from "../src/format";

describe("shortDate", () => {
  it("formats an ISO date as day and month", () => {
    expect(shortDate("2026-10-06")).toBe("6 Oct");
    expect(shortDate("2026-01-31")).toBe("31 Jan");
  });
});
