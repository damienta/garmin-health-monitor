import { describe, expect, it } from "vitest";
import { call, ingest, INGEST, night, READ } from "./helpers";

describe("auth", () => {
  it("rejects ingest without the ingest token", async () => {
    expect((await ingest({ source: "t", nights: [] }, { Authorization: "Bearer test-read" })).status).toBe(401);
    expect((await ingest({ source: "t", nights: [] }, {})).status).toBe(401);
  });

  it("rejects reads without the read token", async () => {
    expect((await call("/api/nights")).status).toBe(401);
    expect((await call("/api/nights", { headers: INGEST })).status).toBe(401);
  });
});

describe("ingest", () => {
  it("validates the body", async () => {
    const res = await ingest({ source: "t", nights: [night("30-09-2026")] });
    expect(res.status).toBe(400);
  });

  it("is idempotent: re-sending a night updates it instead of duplicating", async () => {
    await ingest({ source: "t", nights: [night()] });
    await ingest({ source: "t", nights: [night("2026-09-30", { score: 90 })] });
    const rows = (await (await call("/api/nights?from=2026-09-01&to=2026-09-30", { headers: READ })).json()) as {
      score: number;
    }[];
    expect(rows).toHaveLength(1);
    expect(rows[0].score).toBe(90);
  });

  it("stores raw payloads and exposes stages as rows", async () => {
    await ingest({ source: "t", nights: [night()], raw: [{ date: "2026-09-30", kind: "sleep", payload: { a: 1 } }] });
    const stages = (await (await call("/api/stages?from=2026-09-30&to=2026-09-30", { headers: READ })).json()) as {
      stage: string;
      time: number;
    }[];
    expect(stages.map((s) => s.stage)).toEqual(["light", "deep"]);
    expect(stages[0].time).toBe(1790721600 * 1000);
  });
});

describe("reads", () => {
  it("returns stages for the latest night only", async () => {
    await ingest({
      source: "t",
      nights: [night("2026-09-29", { stages: [{ start_ts: 1, end_ts: 2, stage: "rem" }] }), night()],
    });
    const stages = (await (await call("/api/stages/latest", { headers: READ })).json()) as { date: string }[];
    expect(new Set(stages.map((s) => s.date))).toEqual(new Set(["2026-09-30"]));
    expect(stages).toHaveLength(2);
  });

  it("computes bedtime relative to local midnight", async () => {
    await ingest({ source: "t", nights: [night()] });
    const [row] = (await (await call("/api/nights?from=2026-09-30&to=2026-09-30", { headers: READ })).json()) as {
      bedtime_min: number;
    }[];
    expect(row.bedtime_min).toBe(-20); // 22:40 UTC is 23:40 BST
  });

  it("returns rolling 7-night averages", async () => {
    const nights = Array.from({ length: 8 }, (_, i) =>
      night(`2026-09-${String(20 + i).padStart(2, "0")}`, { score: 70 + i }),
    );
    await ingest({ source: "t", nights });
    const rows = (await (await call("/api/trends?from=2026-09-20&to=2026-09-27", { headers: READ })).json()) as {
      score_7d: number;
    }[];
    expect(rows[0].score_7d).toBe(70);
    expect(rows[7].score_7d).toBe(74); // avg of 71..77
  });

  it("reports health from the last ingest", async () => {
    let health = (await (await call("/api/health", { headers: READ })).json()) as { ok: boolean };
    expect(health.ok).toBe(false);
    await ingest({ source: "t", nights: [night()] });
    health = (await (await call("/api/health", { headers: READ })).json()) as { ok: boolean };
    expect(health.ok).toBe(true);
  });
});
