"""The recovery light for the Discord message.

Same rules as the website (web/src/recovery.ts). Keep the two in step.
Your "normal" is the median of up to 30 nights before the one being checked:
- HRV more than 15% below normal, or resting HR 3+ bpm above normal: yellow
- both, or HRV low two nights running: red
- neither: green
Needs 7 nights of history first.
"""

from __future__ import annotations

from dataclasses import dataclass
from statistics import median

HRV_DROP = 0.15
RHR_RISE = 3
MIN_NIGHTS = 7


@dataclass
class Recovery:
    level: str  # green | yellow | red | unknown
    hrv: float | None
    hrv_normal: float | None
    rhr: float | None
    rhr_normal: float | None


def _normals(rows: list[dict], date: str) -> tuple[float | None, float | None]:
    prior = [r for r in rows if r["date"] < date][-30:]
    hrv = [r["hrv_avg"] for r in prior if r.get("hrv_avg") is not None]
    rhr = [r["resting_hr"] for r in prior if r.get("resting_hr") is not None]
    return (
        median(hrv) if len(hrv) >= MIN_NIGHTS else None,
        median(rhr) if len(rhr) >= MIN_NIGHTS else None,
    )


def _hrv_low(value: float | None, normal: float | None) -> bool:
    return value is not None and normal is not None and value < normal * (1 - HRV_DROP)


def check(rows: list[dict], date: str) -> Recovery:
    """``rows`` are {date, hrv_avg, resting_hr} per night, any order."""
    rows = sorted(rows, key=lambda r: r["date"])
    index = {r["date"]: i for i, r in enumerate(rows)}
    night = rows[index[date]] if date in index else {}
    prev = rows[index[date] - 1] if index.get(date, 0) > 0 else None
    hrv_n, rhr_n = _normals(rows, date)
    hrv, rhr = night.get("hrv_avg"), night.get("resting_hr")
    if hrv_n is None and rhr_n is None:
        return Recovery("unknown", hrv, None, rhr, None)
    hrv_low = _hrv_low(hrv, hrv_n)
    rhr_high = rhr is not None and rhr_n is not None and rhr >= rhr_n + RHR_RISE
    # Yesterday's HRV against its own normal, so two low nights in a row can be spotted.
    twice = (
        hrv_low
        and prev is not None
        and _hrv_low(prev.get("hrv_avg"), _normals(rows, prev["date"])[0])
    )
    if (hrv_low and rhr_high) or twice:
        level = "red"
    elif hrv_low or rhr_high:
        level = "yellow"
    else:
        level = "green"
    return Recovery(level, hrv, hrv_n, rhr, rhr_n)
