# Day 1 explained: the Garmin connection

This walks through every file added on Day 1, in the order worth reading them. The aim is that you can explain each decision in an interview.

## The big picture

```text
your laptop, once:   sleep-collector login ──► Garmin (password + 2FA)
                                   │
                                   ▼
                 ~/.garminconnect/garmin_tokens.json   (chmod 600)
                                   │
every run after:   connect() ──► refresh if needed ──► save rotated tokens
                                   │
                                   ▼
                    fetch_range() ──► raw JSON per night ──► parse_sleep() ──► Night
```

Three ideas carry the whole design:

1. **Log in with a password once, on your laptop.** After that, only tokens are used. Servers doing repeated password logins get rate limited or flagged, and 2FA can't be answered by a robot anyway.
2. **Tokens rotate.** Every refresh gives you a new refresh token. Lose the newest one and you have to log in again. So anything that refreshes also saves.
3. **Keep Garmin at arm's length.** The library is unofficial and can break. Only one file imports it, and the parser treats Garmin's JSON as untrusted input.

## Background: access and refresh tokens

This is standard OAuth, and worth knowing for any API work.

| Token | Lifetime | Used for |
| --- | --- | --- |
| Access token | Short (minutes to hours) | Sent with every API request: `Authorization: Bearer <token>` |
| Refresh token | Long (days to months) | Swapped for a new access token when the old one expires, with no password |

Garmin's access token is a **JWT**: three base64 chunks joined by dots (`header.payload.signature`). The payload is readable JSON containing `iat` (issued at) and `exp` (expires). That's how `inspect-tokens` shows lifetimes without calling Garmin.

**Rotation** means the refresh endpoint returns a new refresh token as well as a new access token. Some providers then reject the old one. We don't yet know if Garmin does (`docs/garmin-findings.md`, Q5), so the code assumes the strict case.

## Reading order

### 1. `collector/pyproject.toml`

The project definition, read by [uv](https://docs.astral.sh/uv/).

- `garminconnect==0.3.2` is pinned exactly. With an unofficial library, an automatic upgrade could silently change behaviour. Dependabot (Day 2) will propose upgrades as PRs that CI tests first.
- `[project.scripts]` creates the `sleep-collector` command that points at `cli.main`.
- `[dependency-groups] dev` holds tools only needed for development (pytest, ruff).
- `uv.lock` (generated) pins every transitive dependency, so CI and your laptop install exactly the same versions. CI runs `uv sync --locked`, which fails if the lock file is out of date.

### 2. `collector/src/sleep_collector/tokens.py`

Offline helpers. Nothing here touches the network, which makes it easy to test and safe to run in CI.

- `token_file()` accepts a folder or a direct `.json` path, so CI can point at a temp file.
- `decode_jwt_payload()` splits on dots, base64-decodes the middle chunk and parses it. The padding line (`"=" * (-len % 4)`) exists because JWTs strip base64 padding but Python's decoder needs it. It returns `None` for non-JWTs (opaque refresh tokens) instead of crashing.
- `TokenInfo.fingerprint` keeps only the last 8 characters. That's enough to see whether a token changed, without printing a secret to your terminal or CI logs.
- `refresh_expiring_within()` powers `check-tokens`. It can only warn if the refresh token is a JWT; opaque tokens have no readable expiry.

### 3. `collector/src/sleep_collector/garmin.py`

The only module that imports `garminconnect`. If Garmin breaks something, this is the file to patch.

- `interactive_login()`: the one place a password is used. `prompt_mfa` is a callback the library calls if Garmin asks for a 2FA code. Passing `tokenstore` makes the library write tokens to that path.
- `connect()`: creates `Garmin()` **with no email or password on purpose**. If the saved tokens are dead, the library has nothing to fall back to, so it fails. We turn every failure into one exception type, `TokensUnusable`, which the CLI turns into a friendly "run login again".
- `force_refresh()`: the library only refreshes when the access token is nearly expired. We refresh on every run so the refresh token never gets old. If Garmin's refresh tokens have a sliding expiry (each use extends it), this keeps the chain alive forever. It calls a private method (`_refresh_di_token`), which is acceptable because it's isolated here and covered by the contract tests.
- `_lock_down()`: sets the token file to `600` (owner read/write only), like an SSH key. The library writes it with default permissions, so we fix them after every write.
- `fetch_range()`: one request per day, oldest first, with a 1.5s pause *between* requests. That's a handful of slow requests a day, which looks like a person rather than a scraper.

### 4. `collector/src/sleep_collector/parse.py`

Turns Garmin's undocumented JSON into our own record. Two layers:

- **Input models** (`_DailySleepDTO`, `_SleepLevel`, ...) mirror Garmin's camelCase field names. `extra="ignore"` means new Garmin fields never break us. Every field is optional because Garmin omits things freely. The leading underscore marks them as private: nothing outside this file should depend on Garmin's naming.
- **Output models** (`Night`, `Stage`) are what the rest of the system uses: snake_case, times in UTC epoch seconds, durations in integer seconds.

Details worth noticing:

- A night is keyed on **the date you woke up** (Garmin's `calendarDate`), because "last night" means the night that ended this morning.
- Garmin sends the start time in both UTC and local time. The difference is your timezone offset (`tz_offset_min`). Storing UTC plus the offset means clock changes and travel never make times ambiguous.
- `parse_sleep()` returns `None` when there's no finished sleep yet (watch not synced). That's normal, not an error.
- `STAGE_BY_LEVEL` maps Garmin's numeric stage codes. The mapping comes from community knowledge, not documentation, so Day 1 includes checking it against the app (Q7).

### 5. `collector/src/sleep_collector/cli.py`

Thin glue: parse arguments, call the modules above, print results, return an exit code.

| Command | Calls Garmin? | Purpose |
| --- | --- | --- |
| `login` | Yes (password) | Laptop only. Saves tokens, then runs `inspect-tokens` |
| `inspect-tokens` | No | Issued, expiry and lifetime of each token |
| `check-tokens` | No | Exit code 3 if the refresh token expires within 14 days |
| `refresh` | Yes | Forces a refresh, prints `rotated=True/False` per token |
| `fetch` | Yes | Saves raw JSON per night, prints a one-line summary each |

Exit codes matter because Day 2's GitHub Action reads them: `0` fine, `2` log in again, `3` log in again soon.

## The tests

Run them with `cd collector && uv run pytest -v`. All 22 run offline in under a second.

### `tests/conftest.py`: a fake Garmin

The interesting one. Instead of mocking our own functions (which would only prove our code calls our code), it replaces the **two network seams inside the real library**:

- `Client._http_post`: where the library POSTs to Garmin's token endpoint. The fake checks the refresh token is valid, issues a new one, and (by default) invalidates the old one.
- `Client._fresh_api_session`: where the library GETs API data. The fake checks the access token and returns a profile, settings or sleep JSON.

It also replaces `Client.login` with a function that **fails the test** if called, proving no code path ever tries a password login.

Everything between those seams is the real pinned `garminconnect` code: reading the token file, deciding when to refresh, rotating, writing the file back, building URLs. If a library upgrade changes any of that, these tests fail before your daily job does.

### `tests/test_garmin_contract.py`

| Test | Proves |
| --- | --- |
| `valid_access_token_is_used_without_refreshing` | No needless refreshes |
| `expired_access_token_refreshes_and_saves_rotated_token` | The library writes rotated tokens to disk (the core assumption) |
| `force_refresh_rotates_and_saves` | Our keep-alive works |
| `daily_chain_survives_many_runs` | 30 runs in a row, each from the previous run's file |
| `losing_the_rotated_token_breaks_the_chain` | Why Day 2 must save the token file after every run |
| `rejected_refresh_token_fails_loudly_without_password_login` | Dead tokens fail cleanly |
| `missing_token_file`, `corrupt_token_file` | Clear errors, no stack traces |
| `fetch_range_calls_sleep_endpoint_per_day` | Right URL, one call per day, oldest first |
| `token_file_is_private_after_refresh` | `chmod 600` is applied |
| `fetch_range_pauses_between_requests_only` | Pacing, with no pointless final pause |

### The other test files

- `test_parse.py`: summary fields, stage order and timing, empty nights, unknown or missing fields. Uses `fixtures/sleep_synthetic.json`, which is **made up** in Garmin's shape. Replace it with a scrubbed real night once you've run `fetch`.
- `test_tokens.py`: JWT decoding, opaque tokens, reading a token file.
- `test_cli.py`: every command end to end against the fake Garmin, including the exit codes.

## CI: `.github/workflows/ci.yml`

On every PR and push to `main`: install with `uv sync --locked`, then `ruff check` (lint), `ruff format --check` (formatting) and `pytest`. `permissions: contents: read` gives the job the least access it needs.

## What Day 1 does not do yet

No database, no Worker, no schedule. Those are Day 2. Keeping Day 1 to "can I reliably get my data out of Garmin" means the riskiest question gets answered first, on its own.

## Check your understanding

1. Why does `connect()` create `Garmin()` with no credentials?
2. What breaks if a run refreshes the token but the token file isn't saved?
3. Why are the parser's input models separate from `Night`?
4. Why fake Garmin at `_http_post` rather than mocking `garmin.connect`?
5. What does `check-tokens` do if the refresh token is opaque?

Answers: 1) so a dead token fails instead of silently trying a password login. 2) the next run starts with a refresh token Garmin may already have invalidated. 3) to stop Garmin's naming and quirks from leaking into the rest of the system. 4) so the real library's token logic is what's being tested. 5) prints "unknown (opaque token)" and exits 0, since there's no expiry to read.
