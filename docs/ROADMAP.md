# Roadmap

Built one slice at a time. Each day ends with something that works on its own. The spike repo ([garmin-health-monitor-spike](https://github.com/damienta/garmin-health-monitor-spike)) has a tested version of every slice to use as a reference.

| Day | Slice | State |
| --- | --- | --- |
| 1 | Garmin connection (collector) | **Done** (see `docs/garmin-findings.md`) |
| 2 | Backend: Worker + D1, daily GitHub Action, healthchecks.io | In review (then `docs/SETUP.md` to go live) |
| 3 | Grafana dashboards and alert | Not started |
| 4 | Frontend (React on the Worker, behind Cloudflare Access) | Not started |
| then | Let it run for a week; fix what breaks | |

## Day 1: Garmin connection

**Goal:** log in once, keep tokens alive, pull real sleep data and turn it into clean records.

- `sleep-collector login | inspect-tokens | check-tokens | refresh | fetch`
- Parser from Garmin JSON to a `Night` record
- Tests: parser, token helpers, contract tests running the real Garmin library against a fake Garmin, CLI
- CI: lint, format, tests

**Done when:**
1. CI is green.
2. On your laptop, `fetch --days 14` matches the Garmin app for 2 or 3 nights.
3. The token results are written down in `docs/garmin-findings.md` (how long tokens last, whether the refresh token rotates).

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

## Day 4: Frontend (optional)

**Goal:** your own page for last night and trends.

- React + Vite + Tailwind served by the same Worker
- Cloudflare Access in front (free, no login code to write)

**Done when:** your URL shows last night after you log in.

## Agent prompt for each day

> Read `CLAUDE.md` and `docs/ROADMAP.md`. Do Day N only, using the spike repo as the reference. One PR, tests passing, explain the code in the PR and in `docs/explained/day-N-*.md`. Update the table above.
