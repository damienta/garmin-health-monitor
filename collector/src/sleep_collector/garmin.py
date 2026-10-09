"""The only module that talks to Garmin.

Everything that depends on the unofficial ``garminconnect`` library lives here, so if
Garmin changes something, this is the one file to patch.

Two rules shape this module:

1. **Password logins only happen on your laptop** (``interactive_login``). Automated
   runs use saved tokens (``connect``) and never fall back to a password, because
   repeated password logins from servers get accounts rate limited or flagged.
2. **Tokens rotate.** Every refresh returns a new refresh token, so every function
   that can refresh also saves the token file.
"""

from __future__ import annotations

import logging
import time
from datetime import date, timedelta
from pathlib import Path

from garminconnect import Garmin

from .tokens import token_file

log = logging.getLogger(__name__)

# Pause between Garmin requests. A handful of slow requests a day looks like a person.
REQUEST_GAP_S = 1.5


class TokensUnusable(RuntimeError):
    """Saved tokens are missing or Garmin rejected them. Fix: run `sleep-collector login`."""


def _lock_down(path: Path) -> None:
    """Make the token file readable by you only (like an SSH key).

    On macOS/Linux this sets permissions to 600. Windows ignores those bits: the file
    is private because it lives in your user folder (C:\\Users\\<you>), and chmod
    there only clears the read-only flag.
    """
    if path.exists():
        path.chmod(0o600)


def interactive_login(email: str, password: str, tokenstore: str) -> Path:
    """Full password login, asking for a 2FA code if your account has it. Laptop only."""
    path = token_file(tokenstore)
    path.parent.mkdir(parents=True, exist_ok=True)
    api = Garmin(email=email, password=password, prompt_mfa=lambda: input("MFA code: ").strip())
    # Passing a tokenstore path makes the library write the tokens there after login.
    api.login(tokenstore=str(path))
    _lock_down(path)
    return path


def connect(tokenstore: str) -> Garmin:
    """Log in from saved tokens only. Never falls back to a password login.

    If the access token is close to expiry, the library refreshes it during
    ``login()`` and writes the rotated tokens back to the same file.
    """
    path = token_file(tokenstore)
    if not path.exists():
        raise TokensUnusable(f"No token file at {path}")
    api = Garmin()  # no email/password on purpose: a dead token must fail loudly
    try:
        api.login(tokenstore=str(path))
    except Exception as e:
        raise TokensUnusable(f"Garmin rejected saved tokens: {e}") from e
    _lock_down(path)
    return api


def force_refresh(api: Garmin, tokenstore: str) -> None:
    """Refresh now, not only near expiry, and save the rotated tokens.

    The library only refreshes when the access token is about to expire. Refreshing on
    every daily run keeps the refresh token as young as possible, which is the best
    chance of the chain never expiring (if Garmin's refresh tokens have a sliding
    lifetime). This calls a private library method, which is why it lives here.
    """
    try:
        api.client._refresh_di_token()
    except Exception as e:
        raise TokensUnusable(f"Garmin rejected the refresh token: {e}") from e
    path = token_file(tokenstore)
    api.client.dump(str(path))
    _lock_down(path)


def fetch_sleep(api: Garmin, day: date) -> dict:
    """Garmin's raw sleep JSON for the night that ended on ``day`` (the wake-up date)."""
    return api.get_sleep_data(day.isoformat())


def fetch_range(api: Garmin, days: int, end: date | None = None) -> dict[str, dict]:
    """Raw sleep JSON for the last ``days`` dates, oldest first, keyed by ISO date."""
    end = end or date.today()
    out: dict[str, dict] = {}
    for i in range(days - 1, -1, -1):
        d = end - timedelta(days=i)
        out[d.isoformat()] = fetch_sleep(api, d)
        log.info("fetched %s", d)
        if i:  # no pause after the last request
            time.sleep(REQUEST_GAP_S)
    return out


def fetch_day_stats(api: Garmin, day: date) -> dict | None:
    """Raw daily summary (steps, stress, Body Battery) for ``day``, or None if Garmin has none.

    Garmin answers "no data" with an error for days the watch wasn't worn, so this one
    returns None instead of failing the whole run.
    """
    try:
        return api.get_stats(day.isoformat())
    except Exception as e:  # extras must never block the sleep data
        log.warning("no daily stats for %s: %s", day, type(e).__name__)
        return None


def fetch_stats_range(api: Garmin, days: int, end: date | None = None) -> dict[str, dict]:
    """Raw daily summaries for the last ``days`` dates, oldest first. Missing days are left out."""
    end = end or date.today()
    out: dict[str, dict] = {}
    for i in range(days - 1, -1, -1):
        d = end - timedelta(days=i)
        raw = fetch_day_stats(api, d)
        if raw:
            out[d.isoformat()] = raw
        time.sleep(REQUEST_GAP_S)
    return out


def fetch_activities(api: Garmin, days: int, end: date | None = None) -> list[dict]:
    """Raw workouts started in the last ``days`` dates (one request per 20 activities)."""
    end = end or date.today()
    start = end - timedelta(days=days - 1)
    try:
        return api.get_activities_by_date(start.isoformat(), end.isoformat())
    except Exception as e:
        log.warning("could not fetch activities: %s", type(e).__name__)
        return []
