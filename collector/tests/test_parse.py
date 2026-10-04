import json
from pathlib import Path

from sleep_collector.parse import parse_sleep

FIXTURE = Path(__file__).parent / "fixtures" / "sleep_synthetic.json"


def load() -> dict:
    return json.loads(FIXTURE.read_text())


def test_parses_summary():
    night = parse_sleep(load())
    assert night is not None
    assert night.date == "2026-09-30"
    assert night.duration_s == 26400
    assert night.score == 81
    assert night.hrv_avg == 62.0
    assert night.resting_hr == 48
    assert night.start_ts == 1790721600
    assert night.tz_offset_min == 60  # BST


def test_maps_stages_in_order():
    night = parse_sleep(load())
    assert [s.stage for s in night.stages] == ["light", "deep", "awake", "rem"]
    assert night.stages[0].start_ts == 1790721600  # 22:40 UTC
    assert night.stages[0].end_ts - night.stages[0].start_ts == 3600


def test_no_sleep_returns_none():
    raw = {"dailySleepDTO": {"calendarDate": "2026-10-01", "sleepTimeSeconds": None}}
    assert parse_sleep(raw) is None


def test_ignores_unknown_fields_and_missing_extras():
    raw = load()
    raw["somethingGarminAddedLater"] = {"x": 1}
    del raw["sleepLevels"]
    del raw["avgOvernightHrv"]
    night = parse_sleep(raw)
    assert night.stages == []
    assert night.hrv_avg is None
