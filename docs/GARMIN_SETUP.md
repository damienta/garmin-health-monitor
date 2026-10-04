# Garmin setup (on your laptop, about 15 minutes)

You only log in once. After that, refreshes keep the tokens alive.

## 1. Before you start

- Your watch is paired with the **Garmin Connect** app and has synced at least one night.
- You know your Garmin Connect email and password.
- If **two-step verification** is on, have your email or phone ready for the code.
- Install [uv](https://docs.astral.sh/uv/getting-started/installation/):

```bash
# macOS / Linux
curl -LsSf https://astral.sh/uv/install.sh | sh
# Windows (PowerShell)
powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"
```

## 2. Log in and save tokens

```bash
git clone https://github.com/damienta/garmin-health-monitor.git
cd garmin-health-monitor/collector
uv sync
uv run sleep-collector login
```

Tokens are saved to `~/.garminconnect/garmin_tokens.json` (on Windows: `C:\Users\<you>\.garminconnect\garmin_tokens.json`). On macOS/Linux the file is set to owner-only (`600`); on Windows it is private because it sits in your user folder.

**Treat that file like a password.** Anyone with it can read your Garmin data. Never commit it or paste it anywhere except, on Day 2, a GitHub secret.

## 3. Check the tokens

```bash
uv run sleep-collector inspect-tokens   # when each token was issued and expires
uv run sleep-collector check-tokens     # OK, or a warning if the refresh token expires soon
uv run sleep-collector refresh          # look for rotated=True on the refresh line
```

## 4. Pull your real sleep

```bash
uv run sleep-collector fetch --days 14
```

One line per night: duration, score, HRV, resting HR, number of stage blocks. Open the Garmin app and compare 2 or 3 nights. Raw JSON lands in `collector/data/raw/` (gitignored).

## Windows notes

- Use **PowerShell**. Every `uv run ...` command works the same.
- After installing uv, close and reopen PowerShell so the `uv` command is found.
- Paths use backslashes, e.g. raw JSON lands in `collector\data\raw\`.

## If something goes wrong

| Error | Meaning | Fix |
| --- | --- | --- |
| `Authentication failed` | Typo in email or password | Run `login` again |
| `All login strategies rate limited (429)` | Too many logins in a short time | Wait an hour, try once |
| `All login strategies exhausted` | Garmin changed its login flow | Check [python-garminconnect issues](https://github.com/cyberjunky/python-garminconnect/issues) for a new release |
| `No token file` / `Garmin rejected saved tokens` | Never logged in, or tokens revoked | Run `login` again |
| A night shows `no sleep recorded (yet)` | Watch hasn't synced that night | Open the Garmin app to sync, re-run |

Don't run `login` over and over: each one is a fresh sign-in. A few is fine; dozens in an hour can get you rate limited.
