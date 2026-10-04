"""Send parsed nights to the Worker's ``POST /api/ingest``.

Two steps: ``build_batches`` turns raw Garmin JSON into upload bodies, and ``push``
sends one body over HTTPS with the ingest token.
"""

from __future__ import annotations

from collections.abc import Iterator

import requests

from .parse import parse_sleep

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


def push(url: str, token: str, body: dict) -> dict:
    """POST one body. Raises on any non-2xx response, so a failed upload fails the run."""
    r = requests.post(
        url.rstrip("/") + "/api/ingest",
        json=body,
        headers={"Authorization": f"Bearer {token}"},
        timeout=30,
    )
    r.raise_for_status()
    return r.json()
