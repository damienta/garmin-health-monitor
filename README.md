# garmin-health-monitor

Personal sleep monitor for my Garmin watch: a Python collector pulls each night's sleep from Garmin Connect, and later slices store it (Cloudflare Worker + D1) and chart it (Grafana, then a small frontend). Everything runs on free plans.

Built in daily slices; see [`docs/ROADMAP.md`](docs/ROADMAP.md).

## Status

**Day 1: Garmin connection.** The collector logs in, keeps tokens alive and fetches sleep.

```bash
cd collector
uv sync
uv run sleep-collector login            # once, on your laptop
uv run sleep-collector fetch --days 14  # pull recent nights
uv run pytest -v                         # offline tests
```

- Setup guide: [`docs/GARMIN_SETUP.md`](docs/GARMIN_SETUP.md)

**Day 2: backend.** A Cloudflare Worker + D1 database stores each night, and a GitHub Action runs `sleep-collector run` every day at 09:23 UTC.

- Go live: [`docs/SETUP.md`](docs/SETUP.md)

**Day 3: Grafana.** An importable dashboard (`grafana/sleep-dashboard.json`) reads the Worker's API: last night's numbers and sleep stages, plus score, time asleep and HRV trends with 7-night averages.

- Set up: [`docs/GRAFANA_SETUP.md`](docs/GRAFANA_SETUP.md)
