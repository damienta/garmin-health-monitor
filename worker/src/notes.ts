import { z } from "zod";
import skill from "./skills/daily-note.md";

/**
 * The AI morning note (Workers AI, on the Cloudflare free plan).
 *
 * 1. `buildFacts` reads last night, the nights before it and yesterday's stats from D1
 *    and boils them down to a small JSON object (2 queries).
 * 2. `writeNote` sends that object to a Workers AI model, with `skills/daily-note.md`
 *    as the instructions, and checks the reply has the right shape.
 *
 * Rules decide the facts (including the recovery light); the model only words the advice.
 */

export const NOTE_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

export const Note = z.object({
  headline: z.string().trim().min(1).max(160),
  do_today: z.array(z.string().trim().min(1).max(200)).min(1).max(3),
  why: z.string().trim().min(1).max(280),
});
export type Note = z.infer<typeof Note>;

/** JSON schema handed to the model so it can only answer in the Note shape. */
const NOTE_SCHEMA = {
  type: "object",
  properties: {
    headline: { type: "string" },
    do_today: { type: "array", items: { type: "string" }, minItems: 2, maxItems: 3 },
    why: { type: "string" },
  },
  required: ["headline", "do_today", "why"],
};

interface NightRow {
  date: string;
  end_ts: number;
  tz_offset_min: number;
  duration_s: number;
  deep_s: number | null;
  rem_s: number | null;
  score: number | null;
  resting_hr: number | null;
  hrv_avg: number | null;
  awake_count: number | null;
  body_battery_change: number | null;
  bedtime_min: number;
}

interface DayRow {
  steps: number | null;
  step_goal: number | null;
  stress_avg: number | null;
  bb_low: number | null;
  bb_high: number | null;
  vigorous_min: number | null;
}

// Same thresholds as the website's recovery light (web/src/recovery.ts) and Discord.
const HRV_DROP = 0.15;
const RHR_RISE = 3;
const MIN_NIGHTS = 7;

const BEDTIME_SQL = `((((start_ts + tz_offset_min * 60) % 86400) / 60 + 720) % 1440) - 720`;

const r1 = (x: number) => Math.round(x * 10) / 10;
const nums = (xs: (number | null)[]) => xs.filter((x): x is number => x != null);
const mean = (xs: (number | null)[]) => {
  const v = nums(xs);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
};
const median = (xs: (number | null)[]) => {
  const s = nums(xs).sort((a, b) => a - b);
  if (!s.length) return null;
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
/** Minutes from midnight (may be negative or over 1440) to "HH:MM". */
export const clock = (min: number) => {
  const m = ((Math.round(min) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
};
const addDays = (date: string, n: number) => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

function recoveryFor(nights: NightRow[], i: number) {
  const prior = nights.slice(Math.max(0, i - 30), i);
  const hrvN = nums(prior.map((n) => n.hrv_avg));
  const rhrN = nums(prior.map((n) => n.resting_hr));
  return {
    hrvNormal: hrvN.length >= MIN_NIGHTS ? median(hrvN) : null,
    rhrNormal: rhrN.length >= MIN_NIGHTS ? median(rhrN) : null,
  };
}

const hrvLow = (v: number | null, normal: number | null) => v != null && normal != null && v < normal * (1 - HRV_DROP);

/** The recovery light for nights[i], with the same rules as the website. */
export function recovery(nights: NightRow[], i: number) {
  const n = nights[i];
  const { hrvNormal, rhrNormal } = recoveryFor(nights, i);
  if (hrvNormal == null && rhrNormal == null) return { level: "unknown", reasons: ["not enough nights yet"] };
  const low = hrvLow(n.hrv_avg, hrvNormal);
  const high = n.resting_hr != null && rhrNormal != null && n.resting_hr >= rhrNormal + RHR_RISE;
  const prev = i > 0 ? nights[i - 1] : null;
  const lowTwice = low && prev != null && hrvLow(prev.hrv_avg, recoveryFor(nights, i - 1).hrvNormal);
  const level = (low && high) || lowTwice ? "red" : low || high ? "yellow" : "green";
  const reasons = [
    ...(low ? [`HRV ${n.hrv_avg} ms is more than 15% below their normal of ${Math.round(hrvNormal!)} ms`] : []),
    ...(high ? [`resting HR ${n.resting_hr} bpm is 3+ above their normal of ${Math.round(rhrNormal!)} bpm`] : []),
    ...(lowTwice ? ["HRV has been low two nights running"] : []),
  ];
  return { level, reasons: reasons.length ? reasons : ["HRV and resting HR are in their normal range"] };
}

/** Everything the model needs about the night that ended on `date`, or null if there's no such night. */
export async function buildFacts(db: D1Database, date: string) {
  const { results: nights } = await db
    .prepare(
      `SELECT date, end_ts, tz_offset_min, duration_s, deep_s, rem_s, score, resting_hr, hrv_avg,
              awake_count, body_battery_change, ${BEDTIME_SQL} AS bedtime_min
       FROM sleep_nights WHERE date BETWEEN ?1 AND ?2 ORDER BY date`,
    )
    .bind(addDays(date, -40), date)
    .all<NightRow>();
  const i = nights.findIndex((n) => n.date === date);
  if (i < 0) return null;
  const n = nights[i];
  const day = await db
    .prepare(
      `SELECT steps, step_goal, stress_avg, bb_low, bb_high, vigorous_min FROM daily_summaries WHERE date = ?1`,
    )
    .bind(addDays(date, -1))
    .first<DayRow>();

  const before = nights.slice(Math.max(0, i - 7), i);
  const week = nights.slice(Math.max(0, i - 6), i + 1);
  const usualH = median(nights.slice(Math.max(0, i - 28), i).map((x) => x.duration_s / 3600));
  const pct = (s: number | null) => (s == null || !n.duration_s ? null : Math.round((100 * s) / n.duration_s));
  const avg = (pick: (x: NightRow) => number | null, digits = 0) => {
    const m = mean(before.map(pick));
    return m == null ? null : digits ? r1(m) : Math.round(m);
  };
  const weekBed = mean(week.map((x) => x.bedtime_min));

  return {
    date,
    night: {
      score: n.score,
      hours_asleep: r1(n.duration_s / 3600),
      bedtime: clock(n.bedtime_min),
      wake_time: clock(((n.end_ts + n.tz_offset_min * 60) % 86400) / 60),
      deep_pct: pct(n.deep_s),
      rem_pct: pct(n.rem_s),
      wake_ups: n.awake_count,
      hrv_ms: n.hrv_avg,
      resting_hr_bpm: n.resting_hr,
      body_battery_gained: n.body_battery_change,
    },
    usual: before.length
      ? {
          score: avg((x) => x.score),
          hours_asleep: avg((x) => x.duration_s / 3600, 1),
          hrv_ms: avg((x) => x.hrv_avg),
          resting_hr_bpm: avg((x) => x.resting_hr),
          bedtime: clock(mean(before.map((x) => x.bedtime_min))!),
        }
      : null,
    recovery: recovery(nights, i),
    yesterday: day
      ? {
          steps: day.steps,
          step_goal: day.step_goal,
          stress_avg: day.stress_avg,
          body_battery_low: day.bb_low,
          body_battery_high: day.bb_high,
          hard_exercise_min: day.vigorous_min,
        }
      : null,
    week: {
      nights: week.length,
      sleep_debt_h: usualH == null ? null : r1(week.reduce((a, x) => a + x.duration_s / 3600 - usualH, 0)),
      average_bedtime: weekBed == null ? null : clock(weekBed),
    },
  };
}
export type Facts = NonNullable<Awaited<ReturnType<typeof buildFacts>>>;

/** No em or en dashes in the note (house style), whatever the model does. */
const tidy = (s: string) => s.replace(/\s*[—–]\s*/g, ", ").replace(/\s+/g, " ").trim();

/** Ask the model for today's note. Throws if it fails or answers in the wrong shape. */
export async function writeNote(ai: Ai, facts: Facts): Promise<Note> {
  const out = (await ai.run(NOTE_MODEL, {
    messages: [
      { role: "system", content: skill },
      { role: "user", content: `Today's data:\n${JSON.stringify(facts)}\n\nWrite today's note.` },
    ],
    response_format: { type: "json_schema", json_schema: NOTE_SCHEMA },
    max_tokens: 400,
    temperature: 0.4,
  })) as { response?: unknown };
  const raw = typeof out?.response === "string" ? JSON.parse(out.response) : out?.response;
  const note = Note.parse(raw);
  return {
    headline: tidy(note.headline),
    do_today: note.do_today.map(tidy),
    why: tidy(note.why),
  };
}
