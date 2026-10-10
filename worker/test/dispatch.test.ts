import { describe, expect, it } from "vitest";
import { daysFor, dispatchCollect } from "../src/dispatch";

type Call = { url: string; init: RequestInit };

function fakeFetch(status: number, body = "") {
  const calls: Call[] = [];
  const fn = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return new Response(status === 204 ? null : body, { status });
  }) as unknown as typeof fetch;
  return { fn, calls };
}

const env = { GITHUB_REPO: "owner/repo", GITHUB_DISPATCH_TOKEN: "gh-test" };

describe("dispatchCollect", () => {
  it("asks GitHub to run collect.yml on main", async () => {
    const { fn, calls } = fakeFetch(204);
    const saturday = new Date("2026-10-10T09:23:00Z");
    expect(await dispatchCollect(env, fn, saturday)).toEqual({ ok: true });
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("https://api.github.com/repos/owner/repo/actions/workflows/collect.yml/dispatches");
    expect(calls[0].init.method).toBe("POST");
    const headers = calls[0].init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer gh-test");
    expect(headers["User-Agent"]).toBeTruthy();
    expect(JSON.parse(calls[0].init.body as string)).toEqual({ ref: "main", inputs: { days: "3" } });
  });

  it("looks back two weeks on Sundays", () => {
    expect(daysFor(new Date("2026-10-11T09:23:00Z"))).toBe("14");
    expect(daysFor(new Date("2026-10-12T09:23:00Z"))).toBe("3");
  });

  it("does nothing when the token is not set", async () => {
    const { fn, calls } = fakeFetch(204);
    const result = await dispatchCollect({ GITHUB_REPO: "owner/repo" }, fn);
    expect(result.ok).toBe(false);
    expect(calls).toHaveLength(0);
  });

  it("reports GitHub errors", async () => {
    const { fn } = fakeFetch(403, "Resource not accessible by personal access token");
    const result = await dispatchCollect(env, fn);
    expect(result).toEqual({ ok: false, reason: expect.stringContaining("403") });
  });
});

describe("scheduled handler", () => {
  it("is exported next to fetch", async () => {
    const mod = await import("../src/index");
    expect(typeof mod.default.fetch).toBe("function");
    expect(typeof mod.default.scheduled).toBe("function");
  });

  it("fails loudly when not configured", async () => {
    const mod = await import("../src/index");
    const env = { GITHUB_REPO: "owner/repo" } as unknown as Env;
    await expect(
      mod.default.scheduled({ cron: "23 9 * * *", scheduledTime: 0, noRetry() {} } as ScheduledController, env),
    ).rejects.toThrow(/not set/);
  });
});
