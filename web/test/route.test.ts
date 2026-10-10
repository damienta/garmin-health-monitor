import { describe, expect, it } from "vitest";
import { pageFor } from "../src/routes";

describe("pageFor", () => {
  it("maps clean paths", () => {
    expect(pageFor("/")).toBe("yesterday");
    expect(pageFor("/trends")).toBe("trends");
    expect(pageFor("/trends/")).toBe("trends");
    expect(pageFor("/anything-else")).toBe("yesterday");
  });

  it("keeps old hash bookmarks working", () => {
    expect(pageFor("/", "#/all")).toBe("trends");
    expect(pageFor("/", "#/")).toBe("yesterday");
  });
});
