import json
import re

from conftest import access_token, make_jwt, read_tokens, write_tokens

from sleep_collector import cli, garmin


def test_check_tokens_ok_with_opaque_refresh(token_path, capsys):
    write_tokens(token_path, access_token(3600))
    assert cli.main(["--tokenstore", str(token_path), "check-tokens"]) == 0
    assert "unknown (opaque token)" in capsys.readouterr().out


def test_check_tokens_warns_when_refresh_expires_soon(token_path):
    import time

    soon = make_jwt({"exp": int(time.time()) + 3 * 86400})
    write_tokens(token_path, access_token(3600), refresh=soon)
    assert cli.main(["--tokenstore", str(token_path), "check-tokens", "--warn-days", "14"]) == 3
    assert cli.main(["--tokenstore", str(token_path), "check-tokens", "--warn-days", "2"]) == 0


def test_refresh_command_reports_rotation(fake_garmin, token_path, capsys):
    write_tokens(token_path, access_token(3600))
    assert cli.main(["--tokenstore", str(token_path), "refresh"]) == 0
    out = capsys.readouterr().out
    assert re.search(r"refresh \(di_refresh_token\)\s+rotated=True", out)
    assert read_tokens(token_path)["di_refresh_token"] == "refresh-1"


def test_fetch_command_writes_raw_json(fake_garmin, token_path, tmp_path, monkeypatch, capsys):
    monkeypatch.setattr(garmin, "REQUEST_GAP_S", 0)
    write_tokens(token_path, access_token(3600))
    out = tmp_path / "raw"
    assert (
        cli.main(["--tokenstore", str(token_path), "fetch", "--days", "2", "--out", str(out)]) == 0
    )
    files = sorted(p.name for p in out.iterdir())
    assert len(files) == 2 and all(f.startswith("sleep-") for f in files)
    assert json.loads((out / files[0]).read_text())["dailySleepDTO"]
    assert "score=81" in capsys.readouterr().out


def test_dead_tokens_exit_2_with_instructions(fake_garmin, token_path, capsys):
    write_tokens(token_path, access_token(-60), refresh="revoked")
    assert cli.main(["--tokenstore", str(token_path), "fetch", "--days", "1"]) == 2
    assert "sleep-collector login" in capsys.readouterr().err
