# garmin-health-monitor: notes for agents

Personal, single-user Garmin sleep monitor. Read `docs/ROADMAP.md` first: it says which day/slice is current and what "done" means.

Reference implementation (all slices, already tested): https://github.com/damienta/garmin-health-monitor-spike

## Layout

- `collector/` Python 3.11, uv. Talks to Garmin. All Garmin calls live in `garmin.py`.
- `worker/` Cloudflare Worker (Hono, TypeScript, Zod) and D1 database. `src/schema.ts` mirrors `Night` in `collector/src/sleep_collector/parse.py`: change both together.
- `grafana/sleep-dashboard.json` importable dashboard (Infinity data source). `collector/tests/e2e/test_grafana_dashboard.py` checks every panel query against the Worker: keep it passing when changing either.
- Day 4 may add a frontend.

## Checks (run before every push)

```bash
cd collector && uv run ruff check . && uv run ruff format --check . && uv run pytest -q
cd worker && npm run typecheck && npm test      # Node 24 / npm 11
```

## Rules

- Never do a Garmin password login in CI. CI only uses saved tokens; `garmin.connect()` must never gain a password fallback.
- Never commit real health data, token files, or `.env` / `.dev.vars`. Test fixtures are synthetic or scrubbed.
- `garminconnect` is pinned exactly. Only bump it after a local `sleep-collector fetch` works.
- Stay on free, non-expiring plans (GitHub private repo, Cloudflare free, Grafana Cloud free, healthchecks.io free).
- D1 free plan: 50 queries per Worker request. Each night is 1 write (stages stored as JSON), so keep `MAX_NIGHTS_PER_REQUEST` at 20 or below.
- New SQL goes in a new numbered file in `worker/migrations/`. Never edit an applied migration.
- One slice per PR. Keep PRs reviewable; explain the code in the PR body.
