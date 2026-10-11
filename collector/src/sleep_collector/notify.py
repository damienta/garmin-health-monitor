"""Morning message to Discord after the daily run.

Discord webhooks take a JSON body with a ``content`` string. The webhook URL is a
secret (anyone with it can post to the channel), so it only lives in GitHub secrets.
"""

from __future__ import annotations

from datetime import date

import requests

from .parse import Day, Night
from .recovery import Recovery


def _hm(seconds: int | None) -> str:
    if seconds is None:
        return "?"
    h, m = divmod(round(seconds / 60), 60)
    return f"{h}h{m:02d}m"


def _day(iso: str) -> str:
    """'2026-10-06' -> 'Tue 6 Oct'."""
    d = date.fromisoformat(iso)
    return f"{d:%a} {d.day} {d:%b}"


def night_message(night: Night | None, expected: str) -> str:
    """Summary of the newest night. ``expected`` is the date we hoped to have (today)."""
    if night is None:
        return f"😴 Collected, but Garmin has no sleep for {_day(expected)} yet."
    score = night.score if night.score is not None else "?"
    lines = [
        f"😴 **Last night** ({_day(night.date)})",
        f"Score **{score}** · {_hm(night.duration_s)} asleep",
        f"Deep {_hm(night.deep_s)} · REM {_hm(night.rem_s)} · "
        f"Light {_hm(night.light_s)} · Awake {_hm(night.awake_s)}",
    ]
    vitals = []
    if night.hrv_avg is not None:
        vitals.append(f"HRV {night.hrv_avg:g} ms")
    if night.resting_hr is not None:
        vitals.append(f"Resting HR {night.resting_hr} bpm")
    if vitals:
        lines.append(" · ".join(vitals))
    if night.date != expected:
        lines.append(f"⚠️ Nothing for {_day(expected)} yet (watch not synced?)")
    return "\n".join(lines)


def day_line(day: Day) -> str:
    """'👟 Tue 6 Oct: 9,412 steps · stress 31 · Body Battery 22-88'. Missing values skipped."""
    parts = []
    if day.steps is not None:
        parts.append(f"{day.steps:,} steps")
    if day.stress_avg is not None:
        parts.append(f"stress {day.stress_avg}")
    if day.bb_low is not None and day.bb_high is not None:
        parts.append(f"Body Battery {day.bb_low}-{day.bb_high}")
    return f"👟 {_day(day.date)}: " + (" · ".join(parts) or "no activity data")


_LIGHT = {
    "green": "🟢 **Recovery: all clear**",
    "yellow": "🟠 **Recovery: worth watching**",
    "red": "🔴 **Recovery: take it easy today**",
}


def recovery_line(r: Recovery) -> str | None:
    """'🟢 Recovery: all clear (HRV 42 ms, normal 41 · resting HR 55, normal 56)'."""
    if r.level not in _LIGHT:
        return None
    bits = []
    if r.hrv is not None and r.hrv_normal is not None:
        bits.append(f"HRV {r.hrv:.0f} ms, normal {r.hrv_normal:.0f}")
    if r.rhr is not None and r.rhr_normal is not None:
        bits.append(f"resting HR {r.rhr:.0f}, normal {r.rhr_normal:.0f}")
    return _LIGHT[r.level] + (f" ({' · '.join(bits)})" if bits else "")


def post_discord(webhook_url: str, content: str) -> None:
    r = requests.post(webhook_url, json={"content": content}, timeout=10)
    r.raise_for_status()
