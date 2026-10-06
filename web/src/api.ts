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
