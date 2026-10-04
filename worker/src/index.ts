import { Hono } from "hono";
import { ZodError } from "zod";
import { bearer } from "./auth";
import { IngestBody, RangeQuery, type Night } from "./schema";

const app = new Hono<{ Bindings: Env }>();

// Health is considered stale after this long without an ingest (daily run + slack).
const STALE_AFTER_S = 30 * 3600;

const now = () => Math.floor(Date.now() / 1000);

/** Resolve ?from&to or ?days into an inclusive [from, to] date range. */
function range(query: Record<string, string>) {
  const q = RangeQuery.parse(query);
  const to = q.to ?? new Date().toISOString().slice(0, 10);
  if (q.from) return { from: q.from, to };
  const start = new Date(`${to}T00:00:00Z`);
  start.setUTCDate(start.getUTCDate() - (q.days - 1));
  return { from: start.toISOString().slice(0, 10), to };
}

/** Bedtime as minutes from local midnight: 23:30 is -30, 00:45 is 45. Keeps averages sane. */
const BEDTIME_SQL = `((((start_ts + tz_offset_min * 60) % 86400) / 60 + 720) % 1440) - 720`;

app.onError((err, c) => {
  if (err instanceof ZodError) return c.json({ error: "bad request", detail: err.message }, 400);
  console.error(err);
  return c.json({ error: "internal error" }, 500);
});

// ---------- write ----------

app.post("/api/ingest", bearer("INGEST_TOKEN"), async (c) => {
  const parsed = IngestBody.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "bad request", detail: parsed.error.issues }, 400);
  const { source, nights, raw } = parsed.data;
  const ts = now();
  const db = c.env.DB;

  // Upserts keyed on date: re-sending the same night is harmless, so retries and
  // overlapping fetch windows never create duplicates.
  const upsertNight = db.prepare(
    `INSERT INTO sleep_nights (date, start_ts, end_ts, tz_offset_min, duration_s, deep_s, light_s,
       rem_s, awake_s, score, resting_hr, hrv_avg, hrv_status, respiration_avg, stress_avg,
       awake_count, body_battery_change, stages_json, updated_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19)
     ON CONFLICT(date) DO UPDATE SET
       start_ts = excluded.start_ts, end_ts = excluded.end_ts, tz_offset_min = excluded.tz_offset_min,
       duration_s = excluded.duration_s, deep_s = excluded.deep_s, light_s = excluded.light_s,
       rem_s = excluded.rem_s, awake_s = excluded.awake_s, score = excluded.score,
       resting_hr = excluded.resting_hr, hrv_avg = excluded.hrv_avg, hrv_status = excluded.hrv_status,
       respiration_avg = excluded.respiration_avg, stress_avg = excluded.stress_avg,
       awake_count = excluded.awake_count, body_battery_change = excluded.body_battery_change,
       stages_json = excluded.stages_json, updated_at = excluded.updated_at`,
  );
  const upsertRaw = db.prepare(
    `INSERT INTO raw_payloads (date, kind, fetched_at, json) VALUES (?1, ?2, ?3, ?4)
     ON CONFLICT(date, kind) DO UPDATE SET fetched_at = excluded.fetched_at, json = excluded.json`,
  );

  const nightValues = (n: Night) => [
    n.date, n.start_ts, n.end_ts, n.tz_offset_min, n.duration_s, n.deep_s, n.light_s, n.rem_s,
    n.awake_s, n.score, n.resting_hr, n.hrv_avg, n.hrv_status, n.respiration_avg, n.stress_avg,
    n.awake_count, n.body_battery_change, JSON.stringify(n.stages), ts,
  ];

  // batch() runs as one transaction: all of it lands or none of it does.
  await db.batch([
    ...nights.map((n) => upsertNight.bind(...nightValues(n))),
    ...raw.map((r) => upsertRaw.bind(r.date, r.kind, ts, JSON.stringify(r.payload))),
    db.prepare(`INSERT INTO ingest_runs (received_at, source, nights) VALUES (?1, ?2, ?3)`)
      .bind(ts, source, nights.length),
  ]);

  return c.json({ ok: true, nights: nights.length, raw: raw.length });
});

// ---------- read (Grafana) ----------
// Every row carries `time` in epoch ms, which Grafana's Infinity datasource uses as the x axis.

const read = bearer("READ_TOKEN");

app.get("/api/nights", read, async (c) => {
  const { from, to } = range(c.req.query());
  const { results } = await c.env.DB.prepare(
    `SELECT date, end_ts * 1000 AS time, start_ts, end_ts, tz_offset_min, duration_s, deep_s,
            light_s, rem_s, awake_s, score, resting_hr, hrv_avg, hrv_status, respiration_avg,
            stress_avg, awake_count, body_battery_change, ${BEDTIME_SQL} AS bedtime_min
     FROM sleep_nights WHERE date BETWEEN ?1 AND ?2 ORDER BY date`,
  ).bind(from, to).all();
  return c.json(results);
});

app.get("/api/nights/:date", read, async (c) => {
  const row = await c.env.DB.prepare(`SELECT * FROM sleep_nights WHERE date = ?1`)
    .bind(c.req.param("date"))
    .first<Record<string, unknown> & { stages_json: string }>();
  if (!row) return c.json({ error: "not found" }, 404);
  const { stages_json, ...night } = row;
  return c.json({ ...night, stages: JSON.parse(stages_json) });
});

app.get("/api/stages", read, async (c) => {
  const { from, to } = range({ days: "1", ...c.req.query() });
  const { results } = await c.env.DB.prepare(
    `SELECT date, start_ts * 1000 AS time, end_ts * 1000 AS time_end, stage
     FROM sleep_stages WHERE date BETWEEN ?1 AND ?2 ORDER BY start_ts`,
  ).bind(from, to).all();
  return c.json(results);
});

// The most recent night's stages, whatever its date. Drives the hypnogram panel.
app.get("/api/stages/latest", read, async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT date, start_ts * 1000 AS time, end_ts * 1000 AS time_end, stage
     FROM sleep_stages WHERE date = (SELECT MAX(date) FROM sleep_nights) ORDER BY start_ts`,
  ).all();
  return c.json(results);
});

// Rolling 7-night averages via SQL window functions.
app.get("/api/trends", read, async (c) => {
  const { from, to } = range(c.req.query());
  const { results } = await c.env.DB.prepare(
    `SELECT date, time, score, duration_h, hrv_avg, resting_hr, bedtime_min,
            ROUND(AVG(score)      OVER w, 1) AS score_7d,
            ROUND(AVG(duration_h) OVER w, 2) AS duration_h_7d,
            ROUND(AVG(hrv_avg)    OVER w, 1) AS hrv_7d
     FROM (
       SELECT date, end_ts * 1000 AS time, score, ROUND(duration_s / 3600.0, 2) AS duration_h,
              hrv_avg, resting_hr, ${BEDTIME_SQL} AS bedtime_min
       FROM sleep_nights WHERE date BETWEEN ?1 AND ?2
     )
     WINDOW w AS (ORDER BY date ROWS BETWEEN 6 PRECEDING AND CURRENT ROW)
     ORDER BY date`,
  ).bind(from, to).all();
  return c.json(results);
});

app.get("/api/summary", read, async (c) => {
  const { from, to } = range(c.req.query());
  const row = await c.env.DB.prepare(
    `SELECT COUNT(*) AS nights,
            ROUND(AVG(score), 1) AS score_avg,
            ROUND(AVG(duration_s) / 3600.0, 2) AS duration_h_avg,
            ROUND(AVG(hrv_avg), 1) AS hrv_avg,
            ROUND(AVG(resting_hr), 1) AS resting_hr_avg,
            AVG(${BEDTIME_SQL}) AS bedtime_mean,
            AVG((${BEDTIME_SQL}) * (${BEDTIME_SQL})) AS bedtime_sq_mean
     FROM sleep_nights WHERE date BETWEEN ?1 AND ?2`,
  ).bind(from, to).first<Record<string, number | null>>();
  const { bedtime_mean, bedtime_sq_mean, ...rest } = row ?? {};
  // Bedtime spread (std dev, minutes): lower means a more consistent schedule.
  const bedtime_sd_min =
    bedtime_mean != null && bedtime_sq_mean != null
      ? Math.round(Math.sqrt(Math.max(0, bedtime_sq_mean - bedtime_mean ** 2)))
      : null;
  const bedtime_mean_min = bedtime_mean == null ? null : Math.round(bedtime_mean);
  // Array of one row: Grafana's Infinity datasource expects rows.
  return c.json([{ from, to, ...rest, bedtime_mean_min, bedtime_sd_min }]);
});

app.get("/api/health", read, async (c) => {
  const last = await c.env.DB.prepare(
    `SELECT received_at, source, nights FROM ingest_runs ORDER BY received_at DESC LIMIT 1`,
  ).first<{ received_at: number; source: string; nights: number }>();
  const latest = await c.env.DB.prepare(`SELECT MAX(date) AS date FROM sleep_nights`)
    .first<{ date: string | null }>();
  const age = last ? now() - last.received_at : null;
  return c.json({
    ok: age !== null && age < STALE_AFTER_S,
    last_ingest_at: last ? last.received_at * 1000 : null,
    last_ingest_age_h: age === null ? null : Math.round(age / 360) / 10,
    last_ingest_source: last?.source ?? null,
    latest_night: latest?.date ?? null,
  });
});

app.notFound((c) => c.json({ error: "not found" }, 404));

export default app;
