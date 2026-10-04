"""Turn Garmin's sleep JSON into the shape we store.

Garmin's ``dailySleepData`` endpoint is undocumented and returns a big nested object.
We read it in two steps:

1. **Validate** it into private ``_...`` pydantic models that mirror Garmin's field
   names. Every field is optional because Garmin omits things freely (watch not worn,
   partial sync, older devices). Unknown fields are ignored, so Garmin adding fields
   never breaks us.
2. **Convert** it into a ``Night``: our own clean record, with snake_case names,
   epoch seconds for times and integer seconds for durations.
"""

from __future__ import annotations

from datetime import UTC, datetime

from pydantic import BaseModel, ConfigDict

# Garmin's ``activityLevel`` codes in ``sleepLevels``. Confirm against the app on Day 1.
STAGE_BY_LEVEL = {0: "deep", 1: "light", 2: "rem", 3: "awake"}


# ---------- Garmin's shape (input) ----------


class _Lenient(BaseModel):
    model_config = ConfigDict(extra="ignore")


class _Score(_Lenient):
    value: int | None = None


class _SleepScores(_Lenient):
    overall: _Score | None = None


class _DailySleepDTO(_Lenient):
    calendarDate: str
    sleepTimeSeconds: int | None = None
    deepSleepSeconds: int | None = None
    lightSleepSeconds: int | None = None
    remSleepSeconds: int | None = None
    awakeSleepSeconds: int | None = None
    sleepStartTimestampGMT: int | None = None  # epoch milliseconds
    sleepEndTimestampGMT: int | None = None
    sleepStartTimestampLocal: int | None = None  # same moment, shifted by your timezone
    averageRespirationValue: float | None = None
    avgSleepStress: float | None = None
    awakeCount: int | None = None
    sleepScores: _SleepScores | None = None


class _SleepLevel(_Lenient):
    startGMT: str  # "2026-09-29T22:40:00.0", UTC without a zone marker
    endGMT: str
    activityLevel: float


class _SleepResponse(_Lenient):
    dailySleepDTO: _DailySleepDTO
    sleepLevels: list[_SleepLevel] | None = None
    restingHeartRate: int | None = None
    avgOvernightHrv: float | None = None
    hrvStatus: str | None = None
    bodyBatteryChange: int | None = None


# ---------- Our shape (output) ----------


class Stage(BaseModel):
    """One block of the hypnogram, e.g. 23:40 to 01:10 deep sleep."""

    start_ts: int  # epoch seconds, UTC
    end_ts: int
    stage: str  # deep | light | rem | awake | unknown


class Night(BaseModel):
    """One night, keyed on the date you woke up (Garmin's calendarDate)."""

    date: str
    start_ts: int
    end_ts: int
    tz_offset_min: int  # local time = UTC + this; 60 in UK summer, 0 in winter
    duration_s: int
    deep_s: int | None
    light_s: int | None
    rem_s: int | None
    awake_s: int | None
    score: int | None
    resting_hr: int | None
    hrv_avg: float | None
    hrv_status: str | None
    respiration_avg: float | None
    stress_avg: float | None
    awake_count: int | None
    body_battery_change: int | None
    stages: list[Stage]


def _gmt_iso_to_epoch(s: str) -> int:
    return int(datetime.fromisoformat(s.rstrip("Z")).replace(tzinfo=UTC).timestamp())


def parse_sleep(raw: dict) -> Night | None:
    """Return the night, or None if Garmin has no finished sleep for that date yet."""
    resp = _SleepResponse.model_validate(raw)
    dto = resp.dailySleepDTO
    if not dto.sleepTimeSeconds or not dto.sleepStartTimestampGMT or not dto.sleepEndTimestampGMT:
        return None

    # Garmin gives the start time twice (UTC and local); the gap is your timezone offset.
    tz_offset_min = 0
    if dto.sleepStartTimestampLocal is not None:
        tz_offset_min = round((dto.sleepStartTimestampLocal - dto.sleepStartTimestampGMT) / 60000)

    overall = dto.sleepScores.overall if dto.sleepScores else None
    stages = [
        Stage(
            start_ts=_gmt_iso_to_epoch(lvl.startGMT),
            end_ts=_gmt_iso_to_epoch(lvl.endGMT),
            stage=STAGE_BY_LEVEL.get(int(lvl.activityLevel), "unknown"),
        )
        for lvl in resp.sleepLevels or []
    ]

    return Night(
        date=dto.calendarDate,
        start_ts=dto.sleepStartTimestampGMT // 1000,
        end_ts=dto.sleepEndTimestampGMT // 1000,
        tz_offset_min=tz_offset_min,
        duration_s=dto.sleepTimeSeconds,
        deep_s=dto.deepSleepSeconds,
        light_s=dto.lightSleepSeconds,
        rem_s=dto.remSleepSeconds,
        awake_s=dto.awakeSleepSeconds,
        score=overall.value if overall else None,
        resting_hr=resp.restingHeartRate,
        hrv_avg=resp.avgOvernightHrv,
        hrv_status=resp.hrvStatus,
        respiration_avg=dto.averageRespirationValue,
        stress_avg=dto.avgSleepStress,
        awake_count=dto.awakeCount,
        body_battery_change=resp.bodyBatteryChange,
        stages=stages,
    )
