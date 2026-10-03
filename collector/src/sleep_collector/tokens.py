"""Read Garmin token files without calling Garmin.

The garminconnect library saves its login as JSON with three fields:

- ``di_token``: the access token. A JWT that Garmin accepts for a short time.
- ``di_refresh_token``: used to get a new access token without a password.
  Garmin hands out a *new* refresh token on every refresh (it "rotates"),
  so the file must be saved after each refresh or the next run fails.
- ``di_client_id``: which Garmin app the tokens belong to.

Nothing here talks to the network, so it is safe to run anywhere.
"""

from __future__ import annotations

import base64
import json
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path

TOKEN_FILENAME = "garmin_tokens.json"


def token_file(tokenstore: str | Path) -> Path:
    """Accept either a directory (``~/.garminconnect``) or a direct path to the JSON file."""
    p = Path(tokenstore).expanduser()
    if p.suffix == ".json":
        return p
    return p / TOKEN_FILENAME


def decode_jwt_payload(token: str) -> dict | None:
    """Return a JWT's middle section (its claims), or None if the token is not a JWT.

    A JWT is three base64 chunks joined by dots: header.payload.signature. We only
    read the payload to learn when the token was issued (``iat``) and expires (``exp``).
    We never check the signature; that is Garmin's job.
    """
    parts = token.split(".")
    if len(parts) < 2:
        return None
    try:
        padded = parts[1] + "=" * (-len(parts[1]) % 4)  # base64 needs length % 4 == 0
        return json.loads(base64.urlsafe_b64decode(padded))
    except (ValueError, json.JSONDecodeError):
        return None


@dataclass
class TokenInfo:
    name: str
    is_jwt: bool
    issued_at: datetime | None
    expires_at: datetime | None
    fingerprint: str  # last 8 chars: enough to spot rotation without printing the token

    @property
    def lifetime(self) -> str:
        if self.issued_at and self.expires_at:
            return str(self.expires_at - self.issued_at)
        return "unknown"

    @property
    def remaining(self) -> str:
        if self.expires_at:
            return str(self.expires_at - datetime.now(UTC))
        return "unknown"


def _ts(value: object) -> datetime | None:
    return datetime.fromtimestamp(int(value), UTC) if isinstance(value, int | float) else None


def describe(name: str, token: str | None) -> TokenInfo | None:
    if not token:
        return None
    payload = decode_jwt_payload(token)
    return TokenInfo(
        name=name,
        is_jwt=payload is not None,
        issued_at=_ts(payload.get("iat")) if payload else None,
        expires_at=_ts(payload.get("exp")) if payload else None,
        fingerprint=token[-8:],
    )


def load_token_infos(tokenstore: str | Path) -> list[TokenInfo]:
    data = json.loads(token_file(tokenstore).read_text())
    infos = [
        describe("access (di_token)", data.get("di_token")),
        describe("refresh (di_refresh_token)", data.get("di_refresh_token")),
    ]
    return [i for i in infos if i]


def refresh_expiring_within(infos: list[TokenInfo], days: int) -> TokenInfo | None:
    """The refresh token if it has a known expiry within ``days``, else None.

    Opaque (non-JWT) refresh tokens have no readable expiry, so they never warn.
    """
    for t in infos:
        if t.name.startswith("refresh") and t.expires_at:
            if (t.expires_at - datetime.now(UTC)).days < days:
                return t
    return None
