"""Daily summary and workout parsing, batching and the Discord line."""

import json

from conftest import FIXTURES

from sleep_collector import notify, push
from sleep_collector.parse import parse_activity, parse_day

STATS = json.loads((FIXTURES / "stats_synthetic.json").read_text())
ACTIVITIES = json.loads((FIXTURES / "activities_synthetic.json").read_text())


def test_parse_day_maps_fields_and_rounds():
    d = parse_day(STATS)
    assert d is not None
    assert d.model_dump() == {
        "date": "2026-09-30",
        "steps": 9412,
        "step_goal": 8000,
        "distance_m": 7310,
        "active_kcal": 512,
        "moderate_min": 24,
        "vigorous_min": 18,
        "stress_avg": 31,
        "stress_max": 88,
        "bb_high": 88,
        "bb_low": 22,
        "bb_charged": 61,
        "bb_drained": 58,
        "resting_hr": 52,
    }


def test_negative_stress_means_no_data():
    d = parse_day({**STATS, "averageStressLevel": -1, "maxStressLevel": -2})
    assert d.stress_avg is None and d.stress_max is None


def test_day_with_nothing_measured_is_skipped():
    assert parse_day({"calendarDate": "2026-09-30", "dailyStepGoal": 8000}) is None


def test_parse_activity():
    run, walk = (parse_activity(a) for a in ACTIVITIES)
    assert run.model_dump() == {
        "id": 1000000001,
        "date": "2026-09-30",
        "start_ts": 1790787900,
        "name": "Evening Run",
        "type": "running",
        "duration_s": 2712,
        "distance_m": 6020,
        "avg_hr": 151,
        "calories": 498,
        "training_load": 112.6,
    }
    assert walk.distance_m is None and walk.training_load is None


def test_daily_batches_respect_the_worker_limits():
    dates = [f"2026-09-{d:02d}" for d in range(1, 24)]
    stats = {d: {**STATS, "calendarDate": d} for d in dates}
    acts = [{**ACTIVITIES[0], "activityId": i} for i in range(30)]
    bodies = list(push.build_daily_batches(stats, acts, "t"))
    assert [len(b["days"]) for b in bodies] == [10, 10, 3, 0, 0]
    assert [len(b["activities"]) for b in bodies] == [0, 0, 0, 25, 5]
    assert all(len(b["raw"]) == len(b["days"]) for b in bodies)


def test_day_line():
    expected = "👟 Wed 30 Sep: 9,412 steps · stress 31 · Body Battery 22-88"
    assert notify.day_line(parse_day(STATS)) == expected
    empty = parse_day({"calendarDate": "2026-09-30", "restingHeartRate": 50})
    assert notify.day_line(empty) == "👟 Wed 30 Sep: no activity data"
