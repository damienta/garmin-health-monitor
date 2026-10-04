-- One row per night, keyed on the date you woke up (Garmin's calendarDate).
-- Times are UTC epoch seconds; tz_offset_min turns them back into local time.
CREATE TABLE sleep_nights (
  date                TEXT PRIMARY KEY CHECK (date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  start_ts            INTEGER NOT NULL,
  end_ts              INTEGER NOT NULL,
  tz_offset_min       INTEGER NOT NULL,
  duration_s          INTEGER NOT NULL,
  deep_s              INTEGER,
  light_s             INTEGER,
  rem_s               INTEGER,
  awake_s             INTEGER,
  score               INTEGER,
  resting_hr          INTEGER,
  hrv_avg             REAL,
  hrv_status          TEXT,
  respiration_avg     REAL,
  stress_avg          REAL,
  awake_count         INTEGER,
  body_battery_change INTEGER,
  -- Stages as a JSON array. Stored inline so one night is one write: the D1 free plan
  -- allows 50 queries per Worker invocation, and a night has 30 to 80 stage segments.
  stages_json         TEXT NOT NULL DEFAULT '[]',
  updated_at          INTEGER NOT NULL
);

-- Query stages as rows anyway.
CREATE VIEW sleep_stages AS
SELECT
  n.date,
  json_extract(s.value, '$.start_ts') AS start_ts,
  json_extract(s.value, '$.end_ts')   AS end_ts,
  json_extract(s.value, '$.stage')    AS stage
FROM sleep_nights n, json_each(n.stages_json) s;

-- Garmin's full response, so new metrics can be parsed later without refetching.
CREATE TABLE raw_payloads (
  date       TEXT NOT NULL,
  kind       TEXT NOT NULL,
  fetched_at INTEGER NOT NULL,
  json       TEXT NOT NULL,
  PRIMARY KEY (date, kind)
);

-- One row per ingest request. Powers /api/health and Grafana's "collector" panel.
CREATE TABLE ingest_runs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  received_at INTEGER NOT NULL,
  source      TEXT NOT NULL,
  nights      INTEGER NOT NULL
);
CREATE INDEX ingest_runs_received_at ON ingest_runs (received_at);
