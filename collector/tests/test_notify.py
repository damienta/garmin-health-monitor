"""Discord morning message: wording, and that it never breaks the daily run."""

import json

import pytest
from conftest import FIXTURES, access_token, write_tokens

from sleep_collector import cli, garmin, notify, push
from sleep_collector.parse import parse_sleep

NIGHT = parse_sleep(json.loads((FIXTURES / "sleep_synthetic.json").read_text()))


def test_message_for_the_expected_night():
    msg = notify.night_message(NIGHT, expected="2026-09-30")
    assert msg.splitlines()[0] == "😴 **Last night** (Wed 30 Sep)"
    assert f"Score **{NIGHT.score}** · 7h20m asleep" in msg
    assert "Deep 1h30m · REM 1h50m · Light 4h00m · Awake 0h20m" in msg
    assert "⚠️" not in msg


def test_message_warns_when_last_night_is_missing():
    msg = notify.night_message(NIGHT, expected="2026-10-01")
    assert "⚠️ Nothing for Thu 1 Oct yet" in msg


def test_message_when_garmin_has_no_sleep():
    assert notify.night_message(None, expected="2026-10-01").startswith("😴 Collected, but")


def test_message_skips_missing_vitals():
    night = NIGHT.model_copy(update={"hrv_avg": None, "resting_hr": None})
    msg = notify.night_message(night, expected="2026-09-30")
    assert "HRV" not in msg and "Resting HR" not in msg


@pytest.fixture
def run_env(fake_garmin, token_path, monkeypatch):
    monkeypatch.setattr(push, "push", lambda *a, **k: {"ok": True})
    monkeypatch.setenv("INGEST_URL", "https://worker.test")
    monkeypatch.setenv("INGEST_TOKEN", "t")
    monkeypatch.setattr(garmin, "REQUEST_GAP_S", 0)
    write_tokens(token_path, access_token(3600))
    return ["--tokenstore", str(token_path), "run", "--days", "2"]


def test_run_posts_to_discord_when_configured(run_env, monkeypatch):
    posts = []
    monkeypatch.setattr(notify, "post_discord", lambda url, content: posts.append((url, content)))
    monkeypatch.setenv("DISCORD_WEBHOOK_URL", "https://discord.test/hook")
    assert cli.main(run_env) == 0
    ((url, content),) = posts
    assert url == "https://discord.test/hook" and "Last night" in content
    assert "👟" in content and "9,412 steps" in content


def test_run_skips_discord_when_not_configured(run_env, monkeypatch):
    monkeypatch.delenv("DISCORD_WEBHOOK_URL", raising=False)
    monkeypatch.setattr(notify, "post_discord", lambda *a: pytest.fail("should not post"))
    assert cli.main(run_env) == 0


def test_discord_failure_does_not_fail_the_run(run_env, monkeypatch, capsys):
    def boom(url, content):
        raise RuntimeError(f"cannot reach {url}")

    monkeypatch.setattr(notify, "post_discord", boom)
    monkeypatch.setenv("DISCORD_WEBHOOK_URL", "https://discord.test/secret-hook")
    assert cli.main(run_env) == 0
    err = capsys.readouterr().err
    assert "Discord message not sent: RuntimeError" in err
    assert "secret-hook" not in err
