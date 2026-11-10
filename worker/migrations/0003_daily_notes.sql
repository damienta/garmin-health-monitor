-- The AI morning note: one row per night (dated by the morning you woke up).
-- Written by POST /api/notes/:date after the daily run; re-running it overwrites the row.
CREATE TABLE daily_notes (
  date         TEXT PRIMARY KEY CHECK (date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  headline     TEXT NOT NULL,
  actions_json TEXT NOT NULL,
  why          TEXT NOT NULL,
  model        TEXT NOT NULL,
  created_at   INTEGER NOT NULL
);
