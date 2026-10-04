"""The daily `run` command end to end, with fake Garmin and a captured ingest."""

import json

import pytest
from conftest import FIXTURES, access_token, read_tokens, write_tokens

from sleep_collector import cli, garmin, push


@pytest.fixture
def sent(monkeypatch):
    bodies: list[dict] = []
    monkeypatch.setattr(push, "push", lambda url, token, body: bodies.append(body) or {"ok": True})
    monkeypatch.setenv("INGEST_URL", "https://worker.test")
    monkeypatch.setenv("INGEST_TOKEN", "t")
    monkeypatch.setattr(garmin, "REQUEST_GAP_S", 0)
    return bodies


def test_run_refreshes_fetches_and_pushes(fake_garmin, token_path, sent):
    write_tokens(token_path, access_token(3600))
    assert cli.main(["--tokenstore", str(token_path), "run", "--days", "3", "--source", "t"]) == 0
    # Keep-alive: refreshed even though the access token was still valid.
    assert fake_garmin.refresh_calls == 1
    assert read_tokens(token_path)["di_refresh_token"] == "refresh-1"
    # The fake returns the same night for every date; the Worker upserts by date.
    (body,) = sent
    assert body["source"] == "t" and len(body["nights"]) == 3
    assert body["raw"][0]["kind"] == "sleep"


def test_run_saves_rotated_token_even_if_push_fails(fake_garmin, token_path, sent, monkeypatch):
    def boom(*a):
        raise RuntimeError("worker down")

    monkeypatch.setattr(push, "push", boom)
    write_tokens(token_path, access_token(3600))
    with pytest.raises(RuntimeError):
        cli.main(["--tokenstore", str(token_path), "run"])
    assert read_tokens(token_path)["di_refresh_token"] == "refresh-1"


def test_run_requires_ingest_env(token_path, monkeypatch):
    monkeypatch.delenv("INGEST_URL", raising=False)
    with pytest.raises(SystemExit, match="INGEST_URL"):
        cli.main(["--tokenstore", str(token_path), "run"])


def test_push_dir_reads_saved_files(tmp_path, sent):
    fixture = json.loads((FIXTURES / "sleep_synthetic.json").read_text())
    (tmp_path / "sleep-2026-09-30.json").write_text(json.dumps(fixture))
    (tmp_path / "notes.txt").write_text("ignored")
    assert cli.main(["push-dir", str(tmp_path)]) == 0
    assert [n["date"] for n in sent[0]["nights"]] == ["2026-09-30"]
