"""Every Grafana panel query must hit a real endpoint and read fields that exist.

Runs against the Worker on wrangler dev (same setup as test_worker_e2e.py), after
seeding one night, so each query returns at least one row to check columns against.
"""

import copy
import json
import os
from datetime import UTC, datetime
from pathlib import Path

import pytest
import requests

from sleep_collector import push

URL = os.environ.get("E2E_URL")
INGEST = os.environ.get("E2E_INGEST_TOKEN", "dev-ingest-token")
READ = os.environ.get("E2E_READ_TOKEN", "dev-read-token")
ROOT = Path(__file__).parents[3]
DASHBOARD = json.loads((ROOT / "grafana" / "sleep-dashboard.json").read_text())
FIXTURE = json.loads((Path(__file__).parents[1] / "fixtures" / "sleep_synthetic.json").read_text())

pytestmark = pytest.mark.skipif(not URL, reason="E2E_URL not set")

# Grafana fills these in at query time; use a range that contains the seeded night.
MACROS = {
    "${__from:date:YYYY-MM-DD}": "2026-09-01",
    "${__to:date:YYYY-MM-DD}": "2026-09-30",
}


def queries():
    for panel in DASHBOARD["panels"]:
        for target in panel["targets"]:
            yield pytest.param(panel["title"], target, id=panel["title"])


@pytest.fixture(scope="module", autouse=True)
def seed():
    # One night inside MACROS' range, and one dated today for the "last few days" stat panels.
    today = copy.deepcopy(FIXTURE)
    today["dailySleepDTO"]["calendarDate"] = datetime.now(UTC).date().isoformat()
    (body,) = push.build_batches({"fixture": FIXTURE, "today": today}, "grafana-test")
    push.push(URL, INGEST, body)


@pytest.mark.parametrize("title,target", list(queries()))
def test_panel_query_matches_api(title, target):
    path = target["url"]
    for macro, value in MACROS.items():
        path = path.replace(macro, value)
    assert "${" not in path, f"unhandled Grafana macro in {path}"

    r = requests.get(URL + path, headers={"Authorization": f"Bearer {READ}"}, timeout=10)
    assert r.status_code == 200, f"{title}: GET {path} -> {r.status_code}"
    data = r.json()
    rows = data if isinstance(data, list) else [data]
    assert rows, f"{title}: {path} returned no rows"

    for col in target["columns"]:
        assert col["selector"] in rows[0], f"{title}: field {col['selector']!r} missing from {path}"


def test_dashboard_uses_infinity_input():
    assert DASHBOARD["__inputs"][0]["pluginId"] == "yesoreyeram-infinity-datasource"
    for panel in DASHBOARD["panels"]:
        assert panel["datasource"]["uid"] == "${DS_INFINITY}", panel["title"]
