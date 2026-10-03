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
uv run pytest -v                         # 22 offline tests
```

- Setup guide: [`docs/GARMIN_SETUP.md`](docs/GARMIN_SETUP.md)
- How the code works: [`docs/explained/day-1-garmin.md`](docs/explained/day-1-garmin.md)
- What to record after your first real run: [`docs/garmin-findings.md`](docs/garmin-findings.md)
