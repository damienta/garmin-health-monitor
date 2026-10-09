"""Command line entry point: ``sleep-collector <command>``.

Each ``cmd_*`` function is one command. They return a process exit code:
0 = OK, 2 = tokens unusable (log in again), 3 = refresh token expires soon.

``run`` is the daily job: refresh tokens, fetch recent nights, send them to the Worker.
"""

from __future__ import annotations

import argparse
import getpass
import json
import logging
import os
import sys
from pathlib import Path

from . import garmin, notify, push
from .parse import parse_activity, parse_day, parse_sleep
from .tokens import load_token_infos, refresh_expiring_within

DEFAULT_TOKENSTORE = os.environ.get("GARMIN_TOKENSTORE", "~/.garminconnect")


def cmd_login(args: argparse.Namespace) -> int:
    """Password + 2FA login. Env vars let you skip the prompts, but typing is safer."""
    email = os.environ.get("GARMIN_EMAIL") or input("Garmin email: ").strip()
    password = os.environ.get("GARMIN_PASSWORD") or getpass.getpass("Garmin password: ")
    path = garmin.interactive_login(email, password, args.tokenstore)
    print(f"Saved tokens to {path}")
    return cmd_inspect(args)


def cmd_inspect(args: argparse.Namespace) -> int:
    """Show when each token was issued and expires. Offline: never calls Garmin."""
    for t in load_token_infos(args.tokenstore):
        print(
            f"{t.name:28} jwt={t.is_jwt!s:5} issued={t.issued_at} expires={t.expires_at} "
            f"lifetime={t.lifetime} remaining={t.remaining} ...{t.fingerprint}"
        )
    return 0


def cmd_check(args: argparse.Namespace) -> int:
    """Exit 3 if the refresh token expires soon, so a scheduled job can warn you early."""
    infos = load_token_infos(args.tokenstore)
    soon = refresh_expiring_within(infos, args.warn_days)
    if soon:
        print(f"WARNING: refresh token expires {soon.expires_at}. Run `sleep-collector login`.")
        return 3
    refresh = next((t for t in infos if t.name.startswith("refresh")), None)
    if refresh is None:
        print("ERROR: no refresh token in the token file", file=sys.stderr)
        return 2
    print(f"OK: refresh token expires {refresh.expires_at or 'unknown (opaque token)'}")
    return 0


def cmd_refresh(args: argparse.Namespace) -> int:
    """Force a refresh and report which tokens changed (rotated)."""
    before = {t.name: t.fingerprint for t in load_token_infos(args.tokenstore)}
    api = garmin.connect(args.tokenstore)
    garmin.force_refresh(api, args.tokenstore)
    for t in load_token_infos(args.tokenstore):
        rotated = before.get(t.name) != t.fingerprint
        print(f"{t.name:28} rotated={rotated!s:5} expires={t.expires_at}")
    return 0


def cmd_fetch(args: argparse.Namespace) -> int:
    """Download recent nights, days and workouts, save the raw JSON, print a summary."""
    api = garmin.connect(args.tokenstore)
    raw = garmin.fetch_range(api, args.days)
    stats = garmin.fetch_stats_range(api, args.days)
    activities = garmin.fetch_activities(api, args.days)
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    for day, payload in raw.items():
        (out / f"sleep-{day}.json").write_text(json.dumps(payload, indent=2))
        night = parse_sleep(payload)
        if night is None:
            print(f"{day}  no sleep recorded (yet)")
            continue
        h, m = divmod(night.duration_s // 60, 60)
        print(
            f"{day}  {h}h{m:02d}m  score={night.score}  hrv={night.hrv_avg}  "
            f"rhr={night.resting_hr}  stages={len(night.stages)}"
        )
    for day, payload in stats.items():
        (out / f"stats-{day}.json").write_text(json.dumps(payload, indent=2))
        d = parse_day(payload)
        if d is not None:
            print(
                f"{day}  steps={d.steps}  stress={d.stress_avg}  "
                f"body_battery={d.bb_low}-{d.bb_high}  active_kcal={d.active_kcal}"
            )
    (out / "activities.json").write_text(json.dumps(activities, indent=2))
    for a in (parse_activity(x) for x in activities):
        mins = (a.duration_s or 0) // 60
        print(f"{a.date}  {a.type}  {a.name}  {mins} min  load={a.training_load}")
    print(f"Raw JSON written to {out}/ (gitignored, contains personal data)")
    return 0


def _ingest_env() -> tuple[str, str]:
    """Where to send data, and the password for it. Set as env vars (GitHub secrets in CI)."""
    url, token = os.environ.get("INGEST_URL"), os.environ.get("INGEST_TOKEN")
    if not url or not token:
        raise SystemExit("ERROR: set INGEST_URL and INGEST_TOKEN")
    return url, token


def _push_all(raw: dict[str, dict], source: str, url: str, token: str) -> int:
    """Send nights in chunks the Worker accepts. Returns how many nights were sent."""
    sent = 0
    for body in push.build_batches(raw, source):
        push.push(url, token, body)
        sent += len(body["nights"])
    return sent


def cmd_run(args: argparse.Namespace) -> int:
    """Daily job: refresh tokens, fetch recent nights and days, push them to the Worker."""
    url, token = _ingest_env()
    api = garmin.connect(args.tokenstore)
    # Refresh first, before anything else can fail, so the token file is always the newest.
    garmin.force_refresh(api, args.tokenstore)
    raw = garmin.fetch_range(api, args.days)
    sent = _push_all(raw, args.source, url, token)
    print(f"Fetched {len(raw)} days, pushed {sent} nights")
    # Steps, stress, Body Battery and workouts. Sleep is already saved by now.
    stats = garmin.fetch_stats_range(api, args.days)
    activities = garmin.fetch_activities(api, args.days)
    days_sent = acts_sent = 0
    for body in push.build_daily_batches(stats, activities, args.source):
        push.push(url, token, body, path="/api/ingest/daily")
        days_sent += len(body["days"])
        acts_sent += len(body["activities"])
    print(f"Pushed {days_sent} days and {acts_sent} activities")
    _notify(raw, stats)
    return 0


def _notify(raw: dict[str, dict], stats: dict[str, dict] | None = None) -> None:
    """Post the newest night (and yesterday's activity) to Discord if DISCORD_WEBHOOK_URL is set.

    Runs after the data is saved, and a Discord problem never fails the run.
    """
    webhook = os.environ.get("DISCORD_WEBHOOK_URL")
    if not webhook or not raw:
        return
    nights = [n for n in (parse_sleep(p) for p in raw.values()) if n is not None]
    latest = max(nights, key=lambda n: n.date, default=None)
    message = notify.night_message(latest, expected=max(raw))
    # Yesterday = the last full day before the newest date fetched.
    yesterday = sorted(d for d in (stats or {}) if d < max(raw))[-1:]
    if yesterday:
        day = parse_day(stats[yesterday[0]])
        if day is not None:
            message += "\n" + notify.day_line(day)
    try:
        notify.post_discord(webhook, message)
    except Exception as e:
        # Only the error type: the message would include the webhook URL, which is a secret.
        print(f"WARNING: Discord message not sent: {type(e).__name__}", file=sys.stderr)


def cmd_push_dir(args: argparse.Namespace) -> int:
    """Push JSON files saved earlier by `fetch`, without calling Garmin."""
    url, token = _ingest_env()
    raw = {p.stem: json.loads(p.read_text()) for p in sorted(Path(args.dir).glob("sleep*.json"))}
    sent = _push_all(raw, args.source, url, token)
    print(f"Read {len(raw)} files, pushed {sent} nights")
    return 0


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(prog="sleep-collector")
    p.add_argument("--tokenstore", default=DEFAULT_TOKENSTORE, help="token dir or .json file")
    p.add_argument("-v", "--verbose", action="store_true")
    sub = p.add_subparsers(dest="cmd", required=True)

    sub.add_parser("login", help="password + 2FA login on your machine; saves tokens")
    sub.add_parser("inspect-tokens", help="show token expiry without calling Garmin")
    c = sub.add_parser("check-tokens", help="exit 3 if the refresh token expires soon")
    c.add_argument("--warn-days", type=int, default=14)
    sub.add_parser("refresh", help="force a token refresh and report rotation")
    f = sub.add_parser("fetch", help="fetch recent nights and save raw JSON")
    f.add_argument("--days", type=int, default=7)
    f.add_argument("--out", default="data/raw")

    r = sub.add_parser("run", help="daily job: refresh, fetch, push (needs INGEST_URL/TOKEN)")
    r.add_argument("--days", type=int, default=3)
    r.add_argument("--source", default=os.environ.get("INGEST_SOURCE", "local"))
    d = sub.add_parser("push-dir", help="push saved raw JSON files to the Worker")
    d.add_argument("dir", nargs="?", default="data/raw")
    d.add_argument("--source", default=os.environ.get("INGEST_SOURCE", "local"))

    args = p.parse_args(argv)
    logging.basicConfig(level=logging.DEBUG if args.verbose else logging.INFO)
    handlers = {
        "login": cmd_login,
        "inspect-tokens": cmd_inspect,
        "check-tokens": cmd_check,
        "refresh": cmd_refresh,
        "fetch": cmd_fetch,
        "run": cmd_run,
        "push-dir": cmd_push_dir,
    }
    try:
        return handlers[args.cmd](args)
    except garmin.TokensUnusable as e:
        print(f"ERROR: {e}\nRun `sleep-collector login` on your machine.", file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main())
