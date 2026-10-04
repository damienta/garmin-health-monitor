# garmin-health-monitor: notes for agents

Personal, single-user Garmin sleep monitor. Read `docs/ROADMAP.md` first: it says which day/slice is current and what "done" means.

Reference implementation (all slices, already tested): https://github.com/damienta/garmin-health-monitor-spike

## Layout

- `collector/` Python 3.11, uv. Talks to Garmin. All Garmin calls live in `garmin.py`.
- Later days add `worker/` (Cloudflare Worker + D1), `grafana/` and a frontend.

## Checks (run before every push)

```bash
cd collector && uv run ruff check . && uv run ruff format --check . && uv run pytest -q
```

## Rules

- Never do a Garmin password login in CI. CI only uses saved tokens; `garmin.connect()` must never gain a password fallback.
- Never commit real health data, token files, or `.env` / `.dev.vars`. Test fixtures are synthetic or scrubbed.
- `garminconnect` is pinned exactly. Only bump it after a local `sleep-collector fetch` works.
- Stay on free, non-expiring plans (GitHub private repo, Cloudflare free, Grafana Cloud free, healthchecks.io free).
- One slice per PR. Keep PRs reviewable; explain the code in the PR body and in `docs/explained/`.
