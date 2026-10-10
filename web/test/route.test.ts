import { describe, expect, it } from "vitest";
import { dayParam, pageFor } from "../src/routes";

describe("pageFor", () => {
  it("maps clean paths", () => {
    expect(pageFor("/")).toBe("daily");
    expect(pageFor("/trends")).toBe("trends");
    expect(pageFor("/trends/")).toBe("trends");
    expect(pageFor("/anything-else")).toBe("daily");
  });

  it("keeps old hash bookmarks working", () => {
    expect(pageFor("/", "#/all")).toBe("trends");
    expect(pageFor("/", "#/")).toBe("daily");
  });
});

describe("dayParam", () => {
  it("reads a valid date and ignores anything else", () => {
    expect(dayParam("?day=2026-10-09")).toBe("2026-10-09");
    expect(dayParam("?day=yesterday")).toBeNull();
    expect(dayParam("")).toBeNull();
  });
});
