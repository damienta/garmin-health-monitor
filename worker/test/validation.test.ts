import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { call, getJson, ingest, night, READ } from "./helpers";

describe("ingest validation", () => {
  it("rejects malformed JSON", async () => {
    expect((await ingest("{not json")).status).toBe(400);
  });

  it("rejects unknown stage names", async () => {
    const bad = night("2026-09-30", { stages: [{ start_ts: 1, end_ts: 2, stage: "dreaming" }] });
    expect((await ingest({ source: "t", nights: [bad] })).status).toBe(400);
  });

  it("rejects missing required fields", async () => {
    const { duration_s: _, ...partial } = night();
    expect((await ingest({ source: "t", nights: [partial] })).status).toBe(400);
  });

  it("rejects more nights than one invocation can write (D1 free plan limit)", async () => {
    const nights = Array.from({ length: 21 }, (_, i) => night(`2026-08-${String(i + 1).padStart(2, "0")}`));
    expect((await ingest({ source: "t", nights })).status).toBe(400);
  });

  it("accepts the maximum batch in one transaction", async () => {
    const nights = Array.from({ length: 20 }, (_, i) => night(`2026-08-${String(i + 1).padStart(2, "0")}`));
    const raw = nights.map((n) => ({ date: n.date, kind: "sleep", payload: { big: "x".repeat(50_000) } }));
    const res = await ingest({ source: "t", nights, raw });
    expect(res.status).toBe(200);
    const count = await env.DB.prepare("SELECT COUNT(*) AS n FROM sleep_nights").first<{ n: number }>();
    expect(count?.n).toBe(20);
  });

  it("accepts nulls for optional metrics (e.g. watch without HRV)", async () => {
    const res = await ingest({ source: "t", nights: [night("2026-09-30", { hrv_avg: null, score: null, stages: [] })] });
    expect(res.status).toBe(200);
  });

  it("logs every ingest run", async () => {
    await ingest({ source: "a", nights: [night()] });
    await ingest({ source: "b", nights: [] });
    const runs = await env.DB.prepare("SELECT source, nights FROM ingest_runs ORDER BY id").all();
    expect(runs.results).toEqual([
      { source: "a", nights: 1 },
      { source: "b", nights: 0 },
    ]);
  });

  it("replaces raw payloads instead of duplicating them", async () => {
    const raw = (v: number) => [{ date: "2026-09-30", kind: "sleep", payload: { v } }];
    await ingest({ source: "t", nights: [night()], raw: raw(1) });
    await ingest({ source: "t", nights: [night()], raw: raw(2) });
    const rows = await env.DB.prepare("SELECT json FROM raw_payloads").all<{ json: string }>();
    expect(rows.results.map((r) => JSON.parse(r.json))).toEqual([{ v: 2 }]);
  });

  it("replaces stages when a night is re-sent", async () => {
    await ingest({ source: "t", nights: [night()] });
    await ingest({ source: "t", nights: [night("2026-09-30", { stages: [{ start_ts: 5, end_ts: 6, stage: "rem" }] })] });
    const stages = await getJson<{ stage: string }[]>("/api/stages?from=2026-09-30&to=2026-09-30");
    expect(stages.map((s) => s.stage)).toEqual(["rem"]);
  });
});

describe("read endpoints", () => {
  it("returns one night with its stages, or 404", async () => {
    await ingest({ source: "t", nights: [night()] });
    const one = await getJson<{ score: number; stages: unknown[]; stages_json?: string }>("/api/nights/2026-09-30");
    expect(one.score).toBe(81);
    expect(one.stages).toHaveLength(2);
    expect(one.stages_json).toBeUndefined();
    expect((await call("/api/nights/2026-01-01", { headers: READ })).status).toBe(404);
  });

  it("filters by date range and defaults to the last 30 days", async () => {
    await ingest({ source: "t", nights: [night("2026-09-01"), night("2026-09-15"), night("2026-09-30")] });
    const mid = await getJson<{ date: string }[]>("/api/nights?from=2026-09-10&to=2026-09-20");
    expect(mid.map((n) => n.date)).toEqual(["2026-09-15"]);
    const recent = await getJson<{ date: string }[]>("/api/nights?days=10&to=2026-09-30");
    expect(recent.map((n) => n.date)).toEqual(["2026-09-30"]);
  });

  it("rejects bad query params", async () => {
    expect((await call("/api/nights?days=0", { headers: READ })).status).toBe(400);
    expect((await call("/api/nights?from=yesterday", { headers: READ })).status).toBe(400);
  });

  it("summarises averages and bedtime spread", async () => {
    // Bedtimes 23:40 and 00:40 BST: mean 00:10 (+10 min), spread 30 min.
    await ingest({
      source: "t",
      nights: [
        night("2026-09-29", { score: 80, duration_s: 7 * 3600 }),
        night("2026-09-30", { score: 90, duration_s: 8 * 3600, start_ts: 1790721600 + 3600 }),
      ],
    });
    const [s] = await getJson<Record<string, number>[]>("/api/summary?from=2026-09-29&to=2026-09-30");
    expect(s).toMatchObject({ nights: 2, score_avg: 85, duration_h_avg: 7.5, bedtime_mean_min: 10, bedtime_sd_min: 30 });
  });

  it("handles an empty database", async () => {
    expect(await getJson("/api/nights")).toEqual([]);
    expect(await getJson("/api/stages/latest")).toEqual([]);
    const [s] = await getJson<Record<string, unknown>[]>("/api/summary");
    expect(s).toMatchObject({ nights: 0, bedtime_sd_min: null });
  });

  it("returns 404 JSON for unknown routes", async () => {
    const res = await call("/nope");
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "not found" });
  });
});
