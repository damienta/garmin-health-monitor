import { exports } from "cloudflare:workers";

export const BASE = "https://sleep.test";
export const INGEST = { Authorization: "Bearer test-ingest", "Content-Type": "application/json" };
export const READ = { Authorization: "Bearer test-read" };

// 2026-09-29 22:40 UTC to 2026-09-30 06:20 UTC, in BST (+60).
export function night(date = "2026-09-30", overrides: Record<string, unknown> = {}) {
  return {
    date,
    start_ts: 1790721600,
    end_ts: 1790749200,
    tz_offset_min: 60,
    duration_s: 26400,
    deep_s: 5400,
    light_s: 14400,
    rem_s: 6600,
    awake_s: 1200,
    score: 81,
    resting_hr: 48,
    hrv_avg: 62,
    hrv_status: "BALANCED",
    respiration_avg: 14.5,
    stress_avg: 17,
    awake_count: 2,
    body_battery_change: 54,
    stages: [
      { start_ts: 1790721600, end_ts: 1790725200, stage: "light" },
      { start_ts: 1790725200, end_ts: 1790730600, stage: "deep" },
    ],
    ...overrides,
  };
}

export const call = (path: string, init?: RequestInit) => exports.default.fetch(new Request(BASE + path, init));

export const ingest = (body: unknown, headers: Record<string, string> = INGEST) =>
  call("/api/ingest", { method: "POST", headers, body: typeof body === "string" ? body : JSON.stringify(body) });

export const getJson = async <T>(path: string): Promise<T> => (await call(path, { headers: READ })).json() as Promise<T>;
