"""Our assumptions about the pinned garminconnect library, checked against a fake Garmin."""

import os
import stat
from datetime import date

import pytest
from conftest import access_token, read_tokens, write_tokens

from sleep_collector import garmin


def test_valid_access_token_is_used_without_refreshing(fake_garmin, token_path):
    write_tokens(token_path, access_token(3600))
    garmin.connect(str(token_path))
    assert fake_garmin.refresh_calls == 0
    assert read_tokens(token_path)["di_refresh_token"] == "refresh-0"


def test_expired_access_token_refreshes_and_saves_rotated_token(fake_garmin, token_path):
    """The core assumption of the daily job: the library writes rotated tokens to disk."""
    write_tokens(token_path, access_token(-60))
    garmin.connect(str(token_path))
    assert fake_garmin.refresh_calls == 1
    saved = read_tokens(token_path)
    assert saved["di_refresh_token"] == "refresh-1"
    assert saved["di_token"] == fake_garmin.current_access


def test_force_refresh_rotates_and_saves(fake_garmin, token_path):
    write_tokens(token_path, access_token(3600))
    api = garmin.connect(str(token_path))
    garmin.force_refresh(api, str(token_path))
    assert read_tokens(token_path)["di_refresh_token"] == "refresh-1"


def test_daily_chain_survives_many_runs(fake_garmin, token_path):
    """Each run starts from the previous run's saved file, like the CI cache does."""
    write_tokens(token_path, access_token(3600))
    for day in range(1, 31):
        api = garmin.connect(str(token_path))
        garmin.force_refresh(api, str(token_path))
        assert read_tokens(token_path)["di_refresh_token"] == f"refresh-{day}"
    assert fake_garmin.refresh_calls == 30


def test_losing_the_rotated_token_breaks_the_chain(fake_garmin, token_path):
    """Why CI must save the token file after every run, even failed ones."""
    write_tokens(token_path, access_token(3600))
    stale = token_path.read_text()
    api = garmin.connect(str(token_path))
    garmin.force_refresh(api, str(token_path))
    token_path.write_text(stale)  # simulate the cache save being lost
    with pytest.raises(garmin.TokensUnusable):
        api = garmin.connect(str(token_path))
        garmin.force_refresh(api, str(token_path))


def test_rejected_refresh_token_fails_loudly_without_password_login(fake_garmin, token_path):
    write_tokens(token_path, access_token(-60), refresh="revoked")
    with pytest.raises(garmin.TokensUnusable):
        garmin.connect(str(token_path))  # fixture asserts no password login was attempted


def test_missing_token_file(fake_garmin, tmp_path):
    with pytest.raises(garmin.TokensUnusable, match="No token file"):
        garmin.connect(str(tmp_path / "nope"))


def test_corrupt_token_file(fake_garmin, token_path):
    token_path.write_text("{not json")
    with pytest.raises(garmin.TokensUnusable):
        garmin.connect(str(token_path))


def test_fetch_range_calls_sleep_endpoint_per_day(fake_garmin, token_path, monkeypatch):
    monkeypatch.setattr(garmin, "REQUEST_GAP_S", 0)
    write_tokens(token_path, access_token(3600))
    api = garmin.connect(str(token_path))
    raw = garmin.fetch_range(api, 3, end=date(2026, 9, 30))
    assert list(raw) == ["2026-09-28", "2026-09-29", "2026-09-30"]
    sleep_calls = [p for p in fake_garmin.api_calls if "dailySleepData" in p]
    assert sleep_calls == ["/wellness-service/wellness/dailySleepData/tester"] * 3
    assert raw["2026-09-30"]["dailySleepDTO"]["calendarDate"] == "2026-09-30"


def test_token_file_is_private_after_refresh(fake_garmin, token_path):
    write_tokens(token_path, access_token(3600))
    token_path.chmod(0o644)
    api = garmin.connect(str(token_path))
    garmin.force_refresh(api, str(token_path))
    mode = token_path.stat().st_mode
    if os.name == "nt":
        # Windows ignores Unix permission bits (privacy comes from the user folder's
        # access rules). chmod only toggles read-only, so check the file stays writable
        # for the next refresh.
        assert mode & stat.S_IWRITE
    else:
        assert mode & 0o777 == 0o600


def test_fetch_range_pauses_between_requests_only(fake_garmin, token_path, monkeypatch):
    pauses: list[float] = []
    monkeypatch.setattr(garmin.time, "sleep", pauses.append)
    write_tokens(token_path, access_token(3600))
    api = garmin.connect(str(token_path))
    garmin.fetch_range(api, 3, end=date(2026, 9, 30))
    assert pauses == [garmin.REQUEST_GAP_S] * 2
