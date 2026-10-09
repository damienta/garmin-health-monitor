import { z } from "zod";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "expected YYYY-MM-DD");

export const Stage = z.object({
  start_ts: z.number().int(),
  end_ts: z.number().int(),
  stage: z.enum(["deep", "light", "rem", "awake", "unknown"]),
});

/** Mirrors `Night` in collector/src/sleep_collector/parse.py. Change both together. */
export const Night = z.object({
  date: isoDate,
  start_ts: z.number().int(),
  end_ts: z.number().int(),
  tz_offset_min: z.number().int().min(-720).max(840),
  duration_s: z.number().int().nonnegative(),
  deep_s: z.number().int().nullable(),
  light_s: z.number().int().nullable(),
  rem_s: z.number().int().nullable(),
  awake_s: z.number().int().nullable(),
  score: z.number().int().nullable(),
  resting_hr: z.number().int().nullable(),
  hrv_avg: z.number().nullable(),
  hrv_status: z.string().nullable(),
  respiration_avg: z.number().nullable(),
  stress_avg: z.number().nullable(),
  awake_count: z.number().int().nullable(),
  body_battery_change: z.number().int().nullable(),
  stages: z.array(Stage).max(500),
});
export type Night = z.infer<typeof Night>;

// D1 free plan: 50 queries per invocation. Each night is 2 writes, plus 1 for the run log.
export const MAX_NIGHTS_PER_REQUEST = 20;

export const IngestBody = z.object({
  source: z.string().min(1).max(64),
  nights: z.array(Night).max(MAX_NIGHTS_PER_REQUEST),
  raw: z
    .array(z.object({ date: isoDate, kind: z.string().min(1).max(32), payload: z.unknown() }))
    .max(MAX_NIGHTS_PER_REQUEST)
    .default([]),
});

/** Mirrors `Day` in collector/src/sleep_collector/parse.py. Change both together. */
const int = z.number().int().nullable();
export const Day = z.object({
  date: isoDate,
  steps: int,
  step_goal: int,
  distance_m: int,
  active_kcal: int,
  moderate_min: int,
  vigorous_min: int,
  stress_avg: int,
  stress_max: int,
  bb_high: int,
  bb_low: int,
  bb_charged: int,
  bb_drained: int,
  resting_hr: int,
});
export type Day = z.infer<typeof Day>;

/** Mirrors `Activity` in collector/src/sleep_collector/parse.py. */
export const Activity = z.object({
  id: z.number().int(),
  date: isoDate,
  start_ts: z.number().int(),
  name: z.string().max(200).nullable(),
  type: z.string().max(64).nullable(),
  duration_s: int,
  distance_m: int,
  avg_hr: int,
  calories: int,
  training_load: z.number().nullable(),
});
export type Activity = z.infer<typeof Activity>;

// Same D1 budget: one write per day, raw JSON and workout, plus nothing else. Keep under 50.
export const MAX_DAILY_WRITES = 48;

export const DailyIngestBody = z
  .object({
    source: z.string().min(1).max(64),
    days: z.array(Day).max(20).default([]),
    activities: z.array(Activity).max(40).default([]),
    raw: z
      .array(z.object({ date: isoDate, kind: z.string().min(1).max(32), payload: z.unknown() }))
      .max(20)
      .default([]),
  })
  .refine((b) => b.days.length + b.activities.length + b.raw.length <= MAX_DAILY_WRITES, {
    message: `at most ${MAX_DAILY_WRITES} rows per request (D1 free plan limit)`,
  });

export const RangeQuery = z.object({
  from: isoDate.optional(),
  to: isoDate.optional(),
  days: z.coerce.number().int().min(1).max(3650).default(30),
});
