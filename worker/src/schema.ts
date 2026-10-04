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

export const RangeQuery = z.object({
  from: isoDate.optional(),
  to: isoDate.optional(),
  days: z.coerce.number().int().min(1).max(3650).default(30),
});
