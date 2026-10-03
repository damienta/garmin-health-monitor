"""Command line entry point: ``sleep-collector <command>``.

Each ``cmd_*`` function is one command. They return a process exit code:
0 = OK, 2 = tokens unusable (log in again), 3 = refresh token expires soon.
"""

from __future__ import annotations

import argparse
import getpass
import json
import logging
import os
import sys
from pathlib import Path

from . import garmin
from .parse import parse_sleep
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
    """Download recent nights, save the raw JSON, print one summary line per night."""
    api = garmin.connect(args.tokenstore)
    raw = garmin.fetch_range(api, args.days)
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
    print(f"Raw JSON written to {out}/ (gitignored, contains personal data)")
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

    args = p.parse_args(argv)
    logging.basicConfig(level=logging.DEBUG if args.verbose else logging.INFO)
    handlers = {
        "login": cmd_login,
        "inspect-tokens": cmd_inspect,
        "check-tokens": cmd_check,
        "refresh": cmd_refresh,
        "fetch": cmd_fetch,
    }
    try:
        return handlers[args.cmd](args)
    except garmin.TokensUnusable as e:
        print(f"ERROR: {e}\nRun `sleep-collector login` on your machine.", file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main())
