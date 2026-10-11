"""Recovery light: the same cases as web/test/recovery.test.ts, so the two stay in step."""

from sleep_collector import notify, recovery


def row(date, hrv, rhr):
    return {"date": date, "hrv_avg": hrv, "resting_hr": rhr}


STEADY = [row(f"2026-09-{i:02d}", 50, 50) for i in range(1, 21)]


def with_nights(*pairs):
    return STEADY + [row(f"2026-09-{21 + i}", h, r) for i, (h, r) in enumerate(pairs)]


def test_green_when_both_normal():
    assert recovery.check(with_nights((49, 51)), "2026-09-21").level == "green"


def test_yellow_when_one_signal_is_off():
    low = recovery.check(with_nights((40, 50)), "2026-09-21")
    assert (low.level, low.hrv_normal) == ("yellow", 50)
    assert recovery.check(with_nights((50, 53)), "2026-09-21").level == "yellow"


def test_red_when_both_are_off():
    assert recovery.check(with_nights((40, 54)), "2026-09-21").level == "red"


def test_red_when_hrv_is_low_two_nights_running():
    assert recovery.check(with_nights((41, 50), (40, 50)), "2026-09-22").level == "red"


def test_needs_a_week_of_history():
    short = STEADY[:3] + [row("2026-09-04", 30, 70)]
    assert recovery.check(short, "2026-09-04").level == "unknown"


def test_missing_value_is_not_a_warning():
    assert recovery.check(with_nights((None, 50)), "2026-09-21").level == "green"


def test_discord_line():
    r = recovery.check(with_nights((42, 55)), "2026-09-21")
    assert notify.recovery_line(r) == (
        "🔴 **Recovery: take it easy today** (HRV 42 ms, normal 50 · resting HR 55, normal 50)"
    )
    assert notify.recovery_line(recovery.Recovery("unknown", None, None, None, None)) is None
