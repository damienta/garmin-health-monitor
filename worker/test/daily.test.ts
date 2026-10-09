import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { call, getJson, INGEST, READ } from "./helpers";

const day = (date: string, overrides: Record<string, unknown> = {}) => ({
  date,
  steps: 9412,
  step_goal: 8000,
  distance_m: 7310,
  active_kcal: 512,
  moderate_min: 24,
  vigorous_min: 18,
  stress_avg: 31,
  stress_max: 88,
  bb_high: 88,
  bb_low: 22,
  bb_charged: 61,
  bb_drained: 58,
  resting_hr: 52,
  ...overrides,
});

const activity = (id: number, overrides: Record<string, unknown> = {}) => ({
  id,
  date: "2026-09-30",
  start_ts: 1790787900,
  name: "Evening Run",
  type: "running",
  duration_s: 2712,
  distance_m: 6020,
  avg_hr: 151,
  calories: 498,
  training_load: 112.6,
  ...overrides,
});

const ingestDaily = (body: unknown, headers: Record<string, string> = INGEST) =>
  call("/api/ingest/daily", { method: "POST", headers, body: JSON.stringify(body) });

describe("daily ingest", () => {
  it("needs the ingest token", async () => {
    expect((await ingestDaily({ source: "t" }, READ)).status).toBe(401);
  });

  it("stores days, workouts and raw JSON, and upserts on re-send", async () => {
    const res = await ingestDaily({
      source: "t",
      days: [day("2026-09-29"), day("2026-09-30")],
      activities: [activity(1)],
      raw: [{ date: "2026-09-30", kind: "stats", payload: { a: 1 } }],
    });
    expect(await res.json()).toEqual({ ok: true, days: 2, activities: 1, raw: 1 });
    await ingestDaily({ source: "t", days: [day("2026-09-30", { steps: 12000 })], activities: [activity(1, { name: "Tempo" })] });

    const days = await getJson<{ date: string; steps: number; steps_7d: number; time: number }[]>(
      "/api/days?from=2026-09-01&to=2026-09-30",
    );
    expect(days.map((d) => [d.date, d.steps])).toEqual([["2026-09-29", 9412], ["2026-09-30", 12000]]);
    expect(days[1].steps_7d).toBe(Math.round((9412 + 12000) / 2));
    expect(days[1].time).toBe(Date.UTC(2026, 8, 30, 12));

    const acts = await getJson<{ id: number; name: string; time: number }[]>("/api/activities?from=2026-09-01&to=2026-09-30");
    expect(acts).toEqual([expect.objectContaining({ id: 1, name: "Tempo", time: 1790787900 * 1000 })]);
    const raw = await env.DB.prepare("SELECT COUNT(*) AS n FROM raw_payloads WHERE kind = 'stats'").first<{ n: number }>();
    expect(raw?.n).toBe(1);
  });

  it("accepts nulls (watch not worn) and an empty body", async () => {
    const nulls = Object.fromEntries(Object.keys(day("x")).map((k) => [k, null]));
    expect((await ingestDaily({ source: "t", days: [{ ...nulls, date: "2026-09-30" }] })).status).toBe(200);
    expect((await ingestDaily({ source: "t" })).status).toBe(200);
  });

  it("rejects bad shapes and requests over the D1 write budget", async () => {
    expect((await ingestDaily({ source: "t", days: [day("30-09-2026")] })).status).toBe(400);
    expect((await ingestDaily({ source: "t", activities: [activity(1, { id: "abc" })] })).status).toBe(400);
    const days = Array.from({ length: 20 }, (_, i) => day(`2026-08-${String(i + 1).padStart(2, "0")}`));
    const raw = days.map((d) => ({ date: d.date, kind: "stats", payload: {} }));
    const acts = Array.from({ length: 9 }, (_, i) => activity(i));
    expect((await ingestDaily({ source: "t", days, raw, activities: acts })).status).toBe(400);
    expect((await ingestDaily({ source: "t", days, raw, activities: acts.slice(0, 8) })).status).toBe(200);
  });

  it("reads need the read token", async () => {
    expect((await call("/api/days")).status).toBe(401);
    expect((await call("/api/activities")).status).toBe(401);
  });
});
