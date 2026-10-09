-- Day 7: what happened during the day, not just the night.

-- One row per calendar day: steps, stress, Body Battery. Keyed on the date, so
-- re-sending a day updates it (same idea as sleep_nights).
CREATE TABLE daily_summaries (
  date         TEXT PRIMARY KEY CHECK (date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  steps        INTEGER,
  step_goal    INTEGER,
  distance_m   INTEGER,
  active_kcal  INTEGER,
  moderate_min INTEGER,
  vigorous_min INTEGER,
  stress_avg   INTEGER,
  stress_max   INTEGER,
  bb_high      INTEGER,
  bb_low       INTEGER,
  bb_charged   INTEGER,
  bb_drained   INTEGER,
  resting_hr   INTEGER,
  updated_at   INTEGER NOT NULL
);

-- One row per workout, keyed on Garmin's activity id.
CREATE TABLE activities (
  id            INTEGER PRIMARY KEY,
  date          TEXT NOT NULL,
  start_ts      INTEGER NOT NULL,
  name          TEXT,
  type          TEXT,
  duration_s    INTEGER,
  distance_m    INTEGER,
  avg_hr        INTEGER,
  calories      INTEGER,
  training_load REAL,
  updated_at    INTEGER NOT NULL
);
CREATE INDEX activities_by_date ON activities (date);
