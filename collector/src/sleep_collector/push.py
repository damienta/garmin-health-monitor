"""Send parsed data to the Worker.

Two steps: ``build_batches`` (nights, to ``POST /api/ingest``) and ``build_daily_batches``
(steps/stress/Body Battery and workouts, to ``POST /api/ingest/daily``) turn raw Garmin
JSON into upload bodies, and ``push`` sends one body over HTTPS with the ingest token.
"""

from __future__ import annotations

from collections.abc import Iterator

import requests

from .parse import parse_activity, parse_day, parse_sleep

# Must not exceed MAX_NIGHTS_PER_REQUEST in worker/src/schema.ts (D1 free plan query limit).
CHUNK = 14


def build_batches(raw_by_date: dict[str, dict], source: str) -> Iterator[dict]:
    """Yield upload bodies of at most CHUNK nights. Dates with no sleep are skipped.

    Each body carries the clean ``Night`` records plus Garmin's original JSON, so the
    Worker can keep the raw data for later. ``yield`` hands back one body at a time.
    """
    nights, raws = [], []
    for payload in raw_by_date.values():
        night = parse_sleep(payload)
        if night is None:
            continue
        nights.append(night.model_dump())
        raws.append({"date": night.date, "kind": "sleep", "payload": payload})
        if len(nights) == CHUNK:
            yield {"source": source, "nights": nights, "raw": raws}
            nights, raws = [], []
    if nights:
        yield {"source": source, "nights": nights, "raw": raws}


# Limits per upload for /api/ingest/daily; the Worker checks the same numbers.
DAY_CHUNK = 10  # each day is 2 writes (summary + raw JSON)
ACTIVITY_CHUNK = 25


def build_daily_batches(
    stats_by_date: dict[str, dict], activities: list[dict], source: str
) -> Iterator[dict]:
    """Yield upload bodies for daily summaries and workouts. Days with no data are skipped."""
    days, raws = [], []
    for payload in stats_by_date.values():
        day = parse_day(payload)
        if day is None:
            continue
        days.append(day.model_dump())
        raws.append({"date": day.date, "kind": "stats", "payload": payload})
    for i in range(0, len(days), DAY_CHUNK):
        yield {
            "source": source,
            "days": days[i : i + DAY_CHUNK],
            "activities": [],
            "raw": raws[i : i + DAY_CHUNK],
        }
    acts = [parse_activity(a).model_dump() for a in activities]
    for i in range(0, len(acts), ACTIVITY_CHUNK):
        yield {"source": source, "days": [], "activities": acts[i : i + ACTIVITY_CHUNK], "raw": []}


def push(url: str, token: str, body: dict, path: str = "/api/ingest") -> dict:
    """POST one body. Raises on any non-2xx response, so a failed upload fails the run."""
    r = requests.post(
        url.rstrip("/") + path,
        json=body,
        headers={"Authorization": f"Bearer {token}"},
        timeout=30,
    )
    r.raise_for_status()
    return r.json()
