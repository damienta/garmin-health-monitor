"""A fake Garmin backend for the real `garminconnect` library.

Only the two network seams of the library are replaced (token POSTs and API GETs), so
these tests exercise the pinned library's real logic: loading the token file, deciding
when to refresh, rotating and saving tokens, and building API URLs. If a library
upgrade changes any of that, these tests fail before production does.
"""

from __future__ import annotations

import base64
import json
import time
from dataclasses import dataclass, field
from pathlib import Path

import garminconnect
import garminconnect.client as gc_client
import pytest

FIXTURES = Path(__file__).parent / "fixtures"


def make_jwt(payload: dict) -> str:
    def b64(d: dict) -> str:
        return base64.urlsafe_b64encode(json.dumps(d).encode()).rstrip(b"=").decode()

    return f"{b64({'alg': 'none'})}.{b64(payload)}.sig"


def access_token(expires_in_s: int, n: int = 0) -> str:
    now = int(time.time())
    return make_jwt({"iat": now, "exp": now + expires_in_s, "client_id": "test-client", "n": n})


class FakeResponse:
    def __init__(self, status: int, body: object):
        self.status_code = status
        self._body = body
        self.ok = status < 400
        self.text = json.dumps(body)
        self.content = self.text.encode()

    def json(self) -> object:
        return self._body


@dataclass
class FakeGarmin:
    """State of the fake server. Tests flip the flags to simulate Garmin's behaviour."""

    valid_refresh_tokens: set[str] = field(default_factory=lambda: {"refresh-0"})
    refresh_calls: int = 0
    api_calls: list[str] = field(default_factory=list)
    sleep_payload: dict = field(
        default_factory=lambda: json.loads((FIXTURES / "sleep_synthetic.json").read_text())
    )
    stats_payload: dict = field(
        default_factory=lambda: json.loads((FIXTURES / "stats_synthetic.json").read_text())
    )
    activities_payload: list = field(
        default_factory=lambda: json.loads((FIXTURES / "activities_synthetic.json").read_text())
    )
    current_access: str | None = None
    # When True, the old refresh token stops working after it is rotated.
    invalidate_on_rotate: bool = True

    def token_post(self, url: str, **kwargs) -> FakeResponse:
        assert url == gc_client.DI_TOKEN_URL, f"unexpected POST {url}"
        data = kwargs["data"]
        assert data["grant_type"] == "refresh_token"
        if data["refresh_token"] not in self.valid_refresh_tokens:
            return FakeResponse(401, {"error": "invalid_grant"})
        self.refresh_calls += 1
        new_refresh = f"refresh-{self.refresh_calls}"
        if self.invalidate_on_rotate:
            self.valid_refresh_tokens.discard(data["refresh_token"])
        self.valid_refresh_tokens.add(new_refresh)
        self.current_access = access_token(3600, self.refresh_calls)
        return FakeResponse(
            200, {"access_token": self.current_access, "refresh_token": new_refresh}
        )

    def api_get(self, method: str, url: str, headers: dict, **kwargs) -> FakeResponse:
        path = url.split("connectapi.garmin.com", 1)[1].split("?")[0]
        self.api_calls.append(path)
        token = headers.get("Authorization", "").removeprefix("Bearer ")
        payload = json.loads(base64.urlsafe_b64decode(token.split(".")[1] + "=="))
        if payload["exp"] < time.time() or (self.current_access and token != self.current_access):
            return FakeResponse(401, {"message": "expired"})
        if path == "/userprofile-service/socialProfile":
            return FakeResponse(200, {"displayName": "tester", "fullName": "Test User"})
        if path == "/userprofile-service/userprofile/user-settings":
            return FakeResponse(200, {"userData": {"measurementSystem": "metric"}})
        if path == "/wellness-service/wellness/dailySleepData/tester":
            return FakeResponse(200, self.sleep_payload)
        if path == "/usersummary-service/usersummary/daily/tester":
            return FakeResponse(200, self.stats_payload)
        if path == "/activitylist-service/activities/search/activities":
            # The library pages 20 at a time until it gets an empty page.
            params = kwargs.get("params") or {}
            first_page = str(params.get("start", "0")) == "0" or "start=0" in url
            return FakeResponse(200, self.activities_payload if first_page else [])
        return FakeResponse(404, {"message": f"no fake for {path}"})


class _FakeSession:
    def __init__(self, fake: FakeGarmin):
        self.fake = fake

    def request(self, method, url, headers=None, **kwargs):
        return self.fake.api_get(method, url, headers or {}, **kwargs)


@pytest.fixture
def fake_garmin(monkeypatch) -> FakeGarmin:
    fake = FakeGarmin()
    monkeypatch.setattr(
        gc_client.Client, "_http_post", lambda self, url, **kw: fake.token_post(url, **kw)
    )
    monkeypatch.setattr(gc_client.Client, "_fresh_api_session", lambda self: _FakeSession(fake))

    def no_password_login(*args, **kwargs):
        raise AssertionError("password login attempted; CI must only ever use saved tokens")

    monkeypatch.setattr(gc_client.Client, "login", no_password_login)
    # The library sleeps between profile retries; don't slow the tests down.
    monkeypatch.setattr(garminconnect.time, "sleep", lambda s: None)
    return fake


@pytest.fixture
def token_path(tmp_path) -> Path:
    return tmp_path / "garmin_tokens.json"


def write_tokens(path: Path, access: str, refresh: str = "refresh-0") -> None:
    path.write_text(
        json.dumps({"di_token": access, "di_refresh_token": refresh, "di_client_id": "test-client"})
    )


def read_tokens(path: Path) -> dict:
    return json.loads(path.read_text())
