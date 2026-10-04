# Day 2b explained: sending sleep to the Worker

Day 1 fetches nights onto your laptop. Day 2a built the Worker that stores them. Day 2b joins them up: two new collector commands send nights to the Worker over the internet.

## The big picture

```text
sleep-collector run
  1. connect()        saved tokens → logged in              (Day 1)
  2. force_refresh()  new access token, token file saved    (Day 1)
  3. fetch_range()    last 3 nights of raw Garmin JSON      (Day 1)
  4. build_batches()  raw JSON → Night records, in chunks   (new: push.py)
  5. push()           POST /api/ingest with INGEST_TOKEN    (new: push.py)
                                     │
                                     ▼
                       Worker upserts into D1               (Day 2a)
```

This `run` command is exactly what the daily GitHub Action will execute in Day 2c.

## New and changed files

### `collector/src/sleep_collector/push.py`

**`build_batches(raw_by_date, source)`**

- Takes the dictionary from `fetch_range` (`{"2026-10-03": {...raw Garmin JSON...}, ...}`).
- Runs `parse_sleep` on each night. Nights with no sleep (`None`) are skipped.
- Groups nights into **chunks of 14**. The Worker accepts at most 20 per request because of the free plan's database limit, so 14 leaves headroom.
- Each chunk becomes one upload body:

```json
{
  "source": "github-actions",
  "nights": [ { "date": "2026-10-03", "duration_s": 24840, "score": 71, ... } ],
  "raw":    [ { "date": "2026-10-03", "kind": "sleep", "payload": { ...Garmin's JSON... } } ]
}
```

- It uses `yield`, which hands back one chunk at a time instead of building them all first.

**`push(url, token, body)`**

- Sends one body to `<url>/api/ingest` with `Authorization: Bearer <token>`.
- `raise_for_status()` turns any error response (401 wrong token, 400 bad data, 500 Worker error) into a Python error, so the run **fails loudly** instead of pretending it worked.

### `collector/src/sleep_collector/cli.py` (two new commands)

| Command | What it does |
| --- | --- |
| `run --days 3` | The daily job: steps 1 to 5 above. Prints `Fetched 3 days, pushed 3 nights` |
| `push-dir data/raw` | Reads the JSON files `fetch` saved earlier and sends them. Doesn't contact Garmin, so it's useful for loading history or testing |

Both read two **environment variables**, values set outside the code:

| Variable | What it is | Where it comes from |
| --- | --- | --- |
| `INGEST_URL` | The Worker's address, e.g. `https://garmin-health-monitor.<you>.workers.dev` | A GitHub secret, or set in your terminal |
| `INGEST_TOKEN` | The Worker's write password | A GitHub secret, or set in your terminal |

If either is missing, the command stops with `ERROR: set INGEST_URL and INGEST_TOKEN`.

**Why `run` refreshes before fetching:** the token file is updated before anything else can fail. Even if the upload later breaks, the newest tokens are already saved. A test checks exactly that.

### `collector/pyproject.toml`

Adds `requests`, the standard Python library for making HTTP requests. It was already installed as part of `garminconnect`; listing it makes the dependency explicit.

## The tests

### `tests/test_run.py` (4 tests, offline)

Uses the fake Garmin from Day 1, and replaces `push.push` with a function that just records what it would have sent.

| Test | Proves |
| --- | --- |
| `run_refreshes_fetches_and_pushes` | One refresh, the token file updated, 3 nights sent in one body with raw JSON |
| `run_saves_rotated_token_even_if_push_fails` | If the Worker is down, the refreshed token is still saved |
| `run_requires_ingest_env` | A clear error when `INGEST_URL` is missing |
| `push_dir_reads_saved_files` | Only `sleep*.json` files are read; other files are ignored |

### `tests/e2e/test_worker_e2e.py` (3 tests, end to end)

The real collector code sends a night to the **real Worker** running locally (`wrangler dev` with a local database), then reads it back.

| Test | Proves |
| --- | --- |
| `push_then_read_back` | Every field of the Python `Night` comes back identical from the Worker. This is how we know the Python model and the Worker's Zod schema agree |
| `push_is_idempotent` | Sending the same night twice still leaves one row |
| `wrong_token_is_rejected` | A bad token gets 401 |

These are **skipped** unless `E2E_URL` is set, so `uv run pytest` stays fast and offline. CI starts the Worker and sets it (the new `e2e` job in `.github/workflows/ci.yml`).

## Trying it on your laptop

Two PowerShell windows.

Window 1, the Worker:

```powershell
cd worker
npm ci
copy .dev.vars.example .dev.vars
npm run db:migrate:local
npm run dev
```

Window 2, the collector, sending the nights you already fetched:

```powershell
cd collector
$env:INGEST_URL = "http://localhost:8787"
$env:INGEST_TOKEN = "dev-ingest-token"
uv run sleep-collector push-dir data/raw
curl.exe -H "Authorization: Bearer dev-read-token" "http://localhost:8787/api/trends?days=14"
```

You should see `pushed 13 nights`, then your 13 nights as JSON with 7-night averages. That's your own data going through the whole backend on your laptop.
