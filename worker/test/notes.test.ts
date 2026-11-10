import { env } from "cloudflare:test";
import { afterEach, describe, expect, it, vi } from "vitest";
import { call, ingest, INGEST, night, READ } from "./helpers";

const fakeReply = {
  headline: "Well recovered — a good day to train.",
  do_today: ["Do your planned workout.", "Be asleep by 23:30 tonight."],
  why: "HRV is above your usual.",
};

afterEach(() => vi.restoreAllMocks());

const addDays = (date: string, n: number) => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/** 10 ordinary nights ending on 2026-09-30, the last one with low HRV and high resting HR. */
async function seed() {
  const nights = Array.from({ length: 10 }, (_, i) => {
    const date = addDays("2026-09-21", i);
    const last = i === 9;
    return night(date, { hrv_avg: last ? 40 : 62, resting_hr: last ? 53 : 48 });
  });
  expect((await ingest({ source: "t", nights })).status).toBe(200);
}

const post = (date: string, headers: Record<string, string> = INGEST) =>
  call(`/api/notes/${date}`, { method: "POST", headers });

describe("AI morning note", () => {
  it("needs the ingest token to write and the read token to read", async () => {
    expect((await post("2026-09-30", READ)).status).toBe(401);
    expect((await call("/api/notes/2026-09-30", { headers: INGEST })).status).toBe(401);
  });

  it("rejects a bad date and 404s when there's no night", async () => {
    expect((await post("yesterday")).status).toBe(400);
    expect((await post("2026-09-30")).status).toBe(404);
  });

  it("sends the facts and the skill to the model, stores the note and serves it", async () => {
    await seed();
    const run = vi.spyOn(env.AI, "run").mockResolvedValue({ response: fakeReply } as never);

    const res = await post("2026-09-30");
    expect(res.status).toBe(200);
    const note = (await res.json()) as Record<string, unknown>;
    // Em dashes are tidied away whatever the model writes.
    expect(note.headline).toBe("Well recovered, a good day to train.");

    const [, input] = run.mock.calls[0] as [string, { messages: { role: string; content: string }[] }];
    expect(input.messages[0].content).toContain("# Daily note");
    const facts = JSON.parse(input.messages[1].content.split("\n")[1]);
    expect(facts.night).toMatchObject({ hours_asleep: 7.3, bedtime: "23:40", wake_time: "07:20", hrv_ms: 40 });
    expect(facts.usual).toMatchObject({ hrv_ms: 62, resting_hr_bpm: 48 });
    expect(facts.recovery.level).toBe("red");

    const stored = (await (await call("/api/notes/2026-09-30", { headers: READ })).json()) as Record<string, unknown>;
    expect(stored).toMatchObject({ date: "2026-09-30", do_today: fakeReply.do_today, why: fakeReply.why });
  });

  it("accepts a JSON string reply and overwrites on re-run", async () => {
    await seed();
    const run = vi.spyOn(env.AI, "run");
    run.mockResolvedValueOnce({ response: JSON.stringify(fakeReply) } as never);
    await post("2026-09-30");
    run.mockResolvedValueOnce({ response: { ...fakeReply, why: "Second take." } } as never);
    await post("2026-09-30");
    const stored = (await (await call("/api/notes/2026-09-30", { headers: READ })).json()) as { why: string };
    expect(stored.why).toBe("Second take.");
  });

  it("returns 502 and stores nothing when the model fails or answers in the wrong shape", async () => {
    await seed();
    const run = vi.spyOn(env.AI, "run");
    run.mockRejectedValueOnce(new Error("quota"));
    expect((await post("2026-09-30")).status).toBe(502);
    run.mockResolvedValueOnce({ response: { headline: "Hi" } } as never);
    expect((await post("2026-09-30")).status).toBe(502);
    expect((await call("/api/notes/2026-09-30", { headers: READ })).status).toBe(404);
  });
});
