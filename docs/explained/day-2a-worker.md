# Day 2a explained: the Worker and database

Day 1 gets sleep out of Garmin onto your laptop. Day 2a builds the place it gets stored: a small web API on Cloudflare with a SQL database behind it. It's free and always on.

## The big picture

```text
collector (Python, Day 2b)                 Grafana / you (Day 3)
        │  POST /api/ingest                        │  GET /api/nights, /api/trends ...
        │  Authorization: Bearer INGEST_TOKEN      │  Authorization: Bearer READ_TOKEN
        ▼                                          ▼
   ┌──────────────── Cloudflare Worker (worker/src/index.ts) ────────────────┐
   │  check token → check data shape (Zod) → SQL → JSON response             │
   └───────────────────────────────┬─────────────────────────────────────────┘
                                   ▼
                       D1 database (SQLite, worker/migrations/)
```

## Words you'll see

| Word | Meaning |
| --- | --- |
| **Cloudflare Worker** | A small program Cloudflare runs for you on the internet. No server to manage. Free plan: 100,000 requests a day |
| **D1** | Cloudflare's database. It's SQLite (a simple SQL database) hosted for you. Free plan: 5 GB |
| **Hono** | A tiny web framework for Workers. Like Express for Node: you write `app.get("/path", handler)` |
| **Zod** | Checks that incoming JSON has the right shape. The TypeScript version of pydantic |
| **wrangler** | Cloudflare's command-line tool: run locally, create the database, deploy |
| **Migration** | A numbered SQL file that creates or changes tables. Applied once, in order |
| **Bearer token** | A secret password sent in the `Authorization` header of a request |
| **Upsert** | "Insert, or update if it already exists". Sending the same night twice updates it instead of duplicating it |

## Files, in reading order

### `worker/wrangler.jsonc`: the Worker's settings

- `name`: the Worker's name, so your URL becomes `garmin-health-monitor.<you>.workers.dev`.
- `main`: the code to run (`src/index.ts`).
- `d1_databases`: connects the database to the code under the name `DB`. **`database_id` is a placeholder.** You create the real database once and paste its id here (see the setup checklist).
- The comment at the bottom lists the two **secrets** (`INGEST_TOKEN`, `READ_TOKEN`). They are never written in files; you set them with `wrangler secret put`.

### `worker/migrations/0001_init.sql`: the tables

| Table | One row per | Why |
| --- | --- | --- |
| `sleep_nights` | Night (keyed on the date you woke up) | The main data: duration, stages, score, HRV, resting HR, and so on |
| `raw_payloads` | Night | Garmin's full original JSON, so new fields can be read later without fetching again |
| `ingest_runs` | Upload from the collector | A log, used to answer "when did data last arrive?" |

Plus a **view** called `sleep_stages`: a saved query that unpacks each night's stage list into rows.

**Why stages are stored as JSON inside the night row** rather than in their own table: the free plan allows 50 database queries per request. A night has 15 to 30 stage blocks (your data), so a separate table could need hundreds of writes for a two-week upload. As JSON, each night is exactly one write, and the view still lets you query stages as rows.

**Times** are stored as UTC seconds plus your timezone offset (`tz_offset_min`), the same as the `Night` record from Day 1.

### `worker/src/schema.ts`: what valid data looks like

Zod rules for incoming data:

- `Night`: every field of a night, with types (`date` must look like `2026-10-04`, stages must be `deep`, `light`, `rem`, `awake` or `unknown`). It **must match `Night` in `collector/.../parse.py`**. The end-to-end test in Day 2b checks that they agree.
- `IngestBody`: an upload contains a `source` label, up to **20 nights**, and optional raw JSON.
- `RangeQuery`: the `?from=...&to=...` or `?days=30` part of read URLs.

Bad input gets a `400 bad request` with the reason, and nothing is saved.

### `worker/src/auth.ts`: the password check

`bearer("INGEST_TOKEN")` is **middleware**: code that runs before the handler. It:

1. Reads `Authorization: Bearer <token>` from the request.
2. Compares it to the secret using a **constant-time compare**. Both values are hashed first, then compared so the time taken never depends on how many characters matched. That stops attackers guessing the token one character at a time.
3. Lets the request through, or returns `401 unauthorized`.

There are **two separate tokens**. The collector gets `INGEST_TOKEN` (can write). Grafana gets `READ_TOKEN` (can only read). If the Grafana token ever leaked, nobody could write fake data with it.

### `worker/src/index.ts`: the API

**Write endpoint:**

| Endpoint | What it does |
| --- | --- |
| `POST /api/ingest` | Checks the token and the data, then runs **one batch**: an upsert per night, an upsert per raw payload, and one row in `ingest_runs`. A batch is a transaction: either everything saves or nothing does |

**Read endpoints** (all need `READ_TOKEN`; every row has `time` in milliseconds so Grafana can plot it):

| Endpoint | Returns |
| --- | --- |
| `GET /api/nights?days=30` (or `?from=&to=`) | One row per night, plus `bedtime_min` |
| `GET /api/nights/2026-10-04` | One night with its stage list, or 404 |
| `GET /api/stages?from=&to=` | Stage blocks as rows |
| `GET /api/stages/latest` | Stage blocks of the most recent night (for the sleep chart) |
| `GET /api/trends?days=90` | Each night plus **7-night rolling averages** of score, duration and HRV |
| `GET /api/summary?days=30` | Averages and **bedtime spread** (how consistent your bedtime is) |
| `GET /api/health` | When data last arrived. `ok: false` if over 30 hours ago |

Two bits of SQL worth understanding:

- **Bedtime as "minutes from midnight"** (`BEDTIME_SQL`): 23:30 becomes `-30` and 00:45 becomes `45`. If it used clock minutes, averaging 23:30 and 00:30 would give midday. This way it gives midnight, which is correct.
- **Rolling averages** use a SQL *window function*: `AVG(score) OVER (ORDER BY date ROWS BETWEEN 6 PRECEDING AND CURRENT ROW)` means "average of this night and the 6 before it".

## The tests (24, against a real local database)

`npm test` uses Cloudflare's test runner, which runs the Worker in the same engine as production with a real local D1 database. Tables are emptied before each test.

| File | What it proves |
| --- | --- |
| `test/api.test.ts` | Wrong or missing tokens are rejected. Ingest validates data. Sending a night twice updates it. Raw payloads are stored. Bedtime maths. 7-night averages. Health goes from `ok: false` to `ok: true` after an upload |
| `test/validation.test.ts` | Malformed JSON, unknown stage names, missing fields, 21 nights (rejected) vs 20 (accepted, even with large payloads), missing HRV allowed, every upload logged, stages and raw data replaced not duplicated, every read endpoint, bad query params, empty database, unknown routes |

## How to run it on your laptop

Needs Node 24 (you have Node from the portfolio; `node --version` should print v24 or newer).

```powershell
cd worker
npm ci
npm test                          # 24 tests
copy .dev.vars.example .dev.vars  # local-only tokens
npm run db:migrate:local          # create the tables in a local database
npm run dev                       # API on http://localhost:8787
```

Nothing is on the internet yet. Deploying to Cloudflare is the setup checklist in Day 2c.
