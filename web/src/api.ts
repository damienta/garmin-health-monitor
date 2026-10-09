/** One night from GET /api/trends. Mirrors the SQL in worker/src/index.ts. */
export interface TrendRow {
  date: string;
  time: number;
  score: number | null;
  score_7d: number | null;
  duration_h: number | null;
  duration_h_7d: number | null;
  hrv_avg: number | null;
  hrv_7d: number | null;
  resting_hr: number | null;
  bedtime_min: number | null;
}

/** Same-origin call: the web Worker adds the read token, so the browser never holds it. */
async function get<T>(path: string): Promise<T> {
  const res = await fetch(path, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`${path} returned ${res.status}`);
  return res.json() as Promise<T>;
}

export const getTrends = (days: number) => get<TrendRow[]>(`/api/trends?days=${days}`);

/** GET /api/health: when data last arrived. */
export interface Health {
  ok: boolean;
  last_ingest_at: number | null;
  last_ingest_age_h: number | null;
  latest_night: string | null;
}

export const getHealth = () => get<Health>("/api/health");

export type StageName = "deep" | "light" | "rem" | "awake";

export interface Stage {
  start_ts: number; // epoch seconds
  end_ts: number;
  stage: StageName | "unknown";
}

/** One night from GET /api/nights/:date, including its stages. */
export interface Night {
  date: string;
  start_ts: number;
  end_ts: number;
  tz_offset_min: number;
  duration_s: number;
  deep_s: number | null;
  light_s: number | null;
  rem_s: number | null;
  awake_s: number | null;
  score: number | null;
  resting_hr: number | null;
  hrv_avg: number | null;
  stages: Stage[];
}

export const getNight = (date: string) => get<Night>(`/api/nights/${date}`);

/** One night from GET /api/nights (no stages). */
export interface NightRow {
  date: string;
  start_ts: number;
  end_ts: number;
  tz_offset_min: number;
  score: number | null;
  bedtime_min: number | null;
  duration_s: number;
  deep_s: number | null;
  light_s: number | null;
  rem_s: number | null;
  awake_s: number | null;
}

export const getNights = (days: number) => get<NightRow[]>(`/api/nights?days=${days}`);

/** One day from GET /api/days (steps, stress, Body Battery). */
export interface DayRow {
  date: string;
  time: number;
  steps: number | null;
  step_goal: number | null;
  steps_7d: number | null;
  distance_m: number | null;
  active_kcal: number | null;
  moderate_min: number | null;
  vigorous_min: number | null;
  stress_avg: number | null;
  stress_max: number | null;
  bb_high: number | null;
  bb_low: number | null;
  bb_charged: number | null;
  bb_drained: number | null;
  resting_hr: number | null;
}

export const getDays = (days: number) => get<DayRow[]>(`/api/days?days=${days}`);

/** One workout from GET /api/activities (newest first). */
export interface ActivityRow {
  id: number;
  date: string;
  time: number;
  name: string | null;
  type: string | null;
  duration_s: number | null;
  distance_m: number | null;
  avg_hr: number | null;
  calories: number | null;
  training_load: number | null;
}

export const getActivities = (days: number) => get<ActivityRow[]>(`/api/activities?days=${days}`);
