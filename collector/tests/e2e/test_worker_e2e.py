"""Collector -> real Worker (wrangler dev + local D1). Proves the Python and Zod schemas agree.

Skipped unless E2E_URL is set. CI starts `wrangler dev` and sets it; locally:
    cd worker && cp .dev.vars.example .dev.vars && npm run db:migrate:local && npm run dev
    cd collector && E2E_URL=http://localhost:8787 uv run pytest tests/e2e -v
"""

import json
import os
from pathlib import Path

import pytest
import requests

from sleep_collector import push
from sleep_collector.parse import parse_day, parse_sleep

URL = os.environ.get("E2E_URL")
INGEST = os.environ.get("E2E_INGEST_TOKEN", "dev-ingest-token")
READ = os.environ.get("E2E_READ_TOKEN", "dev-read-token")
FIXTURE = json.loads((Path(__file__).parents[1] / "fixtures" / "sleep_synthetic.json").read_text())

pytestmark = pytest.mark.skipif(not URL, reason="E2E_URL not set")


def get(path: str):
    r = requests.get(URL + path, headers={"Authorization": f"Bearer {READ}"}, timeout=10)
    r.raise_for_status()
    return r.json()


def test_push_then_read_back():
    (body,) = push.build_batches({"2026-09-30": FIXTURE}, "e2e")
    assert push.push(URL, INGEST, body) == {"ok": True, "nights": 1, "raw": 1}

    night = get("/api/nights/2026-09-30")
    expected = parse_sleep(FIXTURE).model_dump()
    for key, value in expected.items():
        assert night[key] == value, key

    assert get("/api/stages/latest")[0]["stage"] == "light"
    assert get("/api/health")["ok"] is True


def test_push_is_idempotent():
    (body,) = push.build_batches({"2026-09-30": FIXTURE}, "e2e")
    push.push(URL, INGEST, body)
    push.push(URL, INGEST, body)
    rows = get("/api/nights?from=2026-09-30&to=2026-09-30")
    assert len(rows) == 1


def test_wrong_token_is_rejected():
    (body,) = push.build_batches({"2026-09-30": FIXTURE}, "e2e")
    with pytest.raises(requests.HTTPError) as e:
        push.push(URL, "wrong", body)
    assert e.value.response.status_code == 401


STATS = json.loads((Path(__file__).parents[1] / "fixtures" / "stats_synthetic.json").read_text())
ACTIVITIES = json.loads(
    (Path(__file__).parents[1] / "fixtures" / "activities_synthetic.json").read_text()
)


def test_daily_push_then_read_back():
    bodies = list(push.build_daily_batches({"2026-09-30": STATS}, ACTIVITIES, "e2e"))
    for body in bodies:
        push.push(URL, INGEST, body, path="/api/ingest/daily")

    (day,) = get("/api/days?from=2026-09-30&to=2026-09-30")
    expected = parse_day(STATS).model_dump()
    for key, value in expected.items():
        assert day[key] == value, key

    acts = get("/api/activities?from=2026-09-01&to=2026-09-30")
    assert {a["name"] for a in acts} >= {"Evening Run", "Walk"}
