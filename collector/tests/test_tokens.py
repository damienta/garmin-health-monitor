import base64
import json

from sleep_collector.tokens import decode_jwt_payload, load_token_infos


def jwt(payload: dict) -> str:
    def b64(d: dict) -> str:
        return base64.urlsafe_b64encode(json.dumps(d).encode()).rstrip(b"=").decode()

    return f"{b64({'alg': 'none'})}.{b64(payload)}.sig"


def test_decodes_jwt_and_rejects_opaque():
    assert decode_jwt_payload(jwt({"exp": 10}))["exp"] == 10
    assert decode_jwt_payload("opaque-refresh-token") is None


def test_reads_token_file(tmp_path):
    (tmp_path / "garmin_tokens.json").write_text(
        json.dumps(
            {
                "di_token": jwt({"iat": 1_000_000, "exp": 1_003_600}),
                "di_refresh_token": "opaque-refresh-token",
                "di_client_id": "x",
            }
        )
    )
    access, refresh = load_token_infos(tmp_path)
    assert access.is_jwt and access.lifetime == "1:00:00"
    assert not refresh.is_jwt and refresh.lifetime == "unknown"
    assert refresh.fingerprint == "sh-token"
