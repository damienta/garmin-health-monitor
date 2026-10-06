# Roadmap

Built one slice at a time. Each day ends with something that works on its own. The spike repo ([garmin-health-monitor-spike](https://github.com/damienta/garmin-health-monitor-spike)) has a tested version of every slice to use as a reference.

| Day | Slice | State |
| --- | --- | --- |
| 1 | Garmin connection (collector) | **Done** |
| 2 | Backend: Worker + D1, daily GitHub Action, healthchecks.io | **Done** (live) |
| 3 | Grafana dashboards and alert | **Done** |
| 4 | Frontend skeleton behind Cloudflare Access (one trends chart), daily Discord ping, Grafana alerts to Discord | In progress |
| 5 | Frontend proper (last night card, stages chart, trends), Grafana code monitoring | Not started |
| 6 | More Garmin data (steps, stress, Body Battery, training) | Not started |
| 7 | Two pages: Last night (with a written summary) and All time (best/worst nights, averages, streaks, bedtime chart) | Not started |

## Day 1: Garmin connection

**Goal:** log in once, keep tokens alive, pull real sleep data and turn it into clean records.

- `sleep-collector login | inspect-tokens | check-tokens | refresh | fetch`
- Parser from Garmin JSON to a `Night` record
- Tests: parser, token helpers, contract tests running the real Garmin library against a fake Garmin, CLI
- CI: lint, format, tests

**Done when:**
1. CI is green.
2. On your laptop, `fetch --days 14` matches the Garmin app for 2 or 3 nights.
3. You know how long the tokens last and whether the refresh token rotates.

**You learn:** Python packaging with uv, OAuth access/refresh tokens, working with an unofficial API safely, contract testing.

## Day 2: Backend

**Goal:** data lands in a database every morning without you.

- Cloudflare Worker (Hono + TypeScript + Zod) and D1, `POST /api/ingest` and read endpoints
- Collector `run` (refresh, fetch, push) and `push-dir`
- `collect.yml` daily at 09:23 UTC with the token cache, plus healthchecks.io
- End-to-end test: collector to Worker on `wrangler dev`

**Done when:** your `workers.dev` URL returns your nights, and the next scheduled run succeeds on its own.

## Day 3: Grafana

**Goal:** see it.

- Grafana Cloud, Infinity data source, import and tune the dashboard
- Alert when no data for 30h
- Test that every panel query matches the API

**Done when:** a month of your sleep is on the dashboard and the alert fires in a test.

## Day 4: Frontend skeleton and Discord

**Goal:** your own private page, and a phone ping every morning.

- `web/`: React + TypeScript (Vite) served by a second Worker, `garmin-health-monitor-web`
- That Worker's `/api/*` checks the Cloudflare Access JWT, then calls the API Worker through a service binding with `READ_TOKEN`. The browser never holds a token
- One chart: sleep score with its 7-night average
- Daily Discord message after each collect run (and on failure); Grafana alerts to Discord

**Done when:** your web URL asks for your email, then shows the chart; Discord gets last night's numbers each morning.

## Day 5: Frontend proper, code monitoring

- Last night card, stages chart, trends (score, duration, HRV + resting HR)
- Grafana panels for the system itself: Worker requests and errors, daily job history

## Day 6: More Garmin data

- Steps, stress, Body Battery, training load: collector, new migration, API, charts

## Day 7: Last night and All time

- Last night page with a written summary generated from the numbers (no AI)
- All time page: best and worst score with dates, averages, streaks, bedtime consistency chart

## Agent prompt for each day

> Read `CLAUDE.md` and `docs/ROADMAP.md`. Do Day N only, using the spike repo as the reference. One PR, tests passing, explain the code in the PR. Update the table above.
