# Guide

How the whole thing works, one part at a time, and what every section of the website means.

## How the data gets here

```
Watch → Garmin Connect → collector (GitHub Actions) → API Worker + D1 (Cloudflare) → website, Grafana, Discord
```

### Your watch and Garmin Connect

- The watch records sleep, heart rate, stress, steps and Body Battery.
- The Garmin Connect app on your phone uploads it to Garmin's servers when it syncs.
- Nothing here talks to the watch directly. Everything is read from Garmin Connect.

### The collector (`collector/`)

- A small Python program, `sleep-collector`.
- It logs in to Garmin Connect with saved tokens. It never uses your password in the cloud.
- For each recent day it reads that night's sleep plus the day's stats (steps, stress, Body Battery). It sends them to the API.
- Each run re-reads the last 3 days (14 on Sundays). So a late watch sync is picked up the next morning.
- Afterwards it posts a short morning message to Discord: last night, the recovery light, and the day's steps, stress and Body Battery.

### The daily run (`.github/workflows/collect.yml` and the Cloudflare timer)

- GitHub Actions runs the collector on GitHub's computers, for free.
- **What starts it:** a Cloudflare Cron Trigger on the API Worker fires at 09:23 UTC every day. It calls GitHub's "run this workflow now" API.
  - The code is `worker/src/dispatch.ts`.
  - The schedule is `"triggers"` in `worker/wrangler.jsonc`.
  - It needs the `GITHUB_DISPATCH_TOKEN` secret on the Worker.
- **Why Cloudflare starts it:** GitHub's own schedule is low priority and often ran hours late (09:23 became about 16:20). Cloudflare's timers fire on time.
- **The backup:** GitHub's own schedule still runs at 13:23. It skips itself if today's run already worked.
- If a run fails, Discord gets a ❌ message. If no run arrives at all, healthchecks.io emails you.

### Tests and deploys (`.github/workflows/`)

- **Every pull request** runs `ci.yml`. It covers lint, format and type checks, about 150 tests (collector, API, website, end to end) and a production build, on Linux and Windows. Everything runs on made-up test data: a fake Garmin server and a throwaway local database, never your account.
- **Every merge to main** that touches `worker/` or `web/` runs `deploy.yml` / `deploy-web.yml`. These test again, deploy to Cloudflare, then run a **smoke test** on the live site (`.github/scripts/smoke.sh`):
  - The API must still refuse a request without a token (401).
  - The website must still send signed-out visitors to the Cloudflare Access sign-in page.
  - If either check fails, Discord gets a ❌ message.

### The API and database (`worker/`)

- A Cloudflare Worker, a small program that runs on Cloudflare's servers, holds the data in D1 (SQLite).
- `POST /api/ingest` and `/api/ingest/daily` are how the collector saves nights and days. They need `INGEST_TOKEN`.
- `GET /api/...` endpoints return nights, stages, trends (with 7-night averages), days and health. They need `READ_TOKEN`.
- Saving the same night twice just overwrites it, so re-runs are safe.

### The website (`web/`)

- A React app, served by a second Worker (`garmin-health-monitor-web`).
- Cloudflare Access sits in front of it, so only you can sign in.
- The browser never sees a token. The web Worker checks your Access login, then asks the API Worker for data with `READ_TOKEN`.
- All the text and insights are simple rules in TypeScript, running in your browser. There's no AI and no cost.

### Grafana and Discord

- **Grafana Cloud** reads the same API through the Infinity plugin: a Sleep dashboard, a System health dashboard (`GET /api/runs`) and a "no data" alert.
- **Discord** gets the morning summary with the recovery light (🟢 / 🟠 / 🔴, same rules as the website), plus a ❌ ping if the daily run fails. The collector reads your recent HRV and resting HR from `GET /api/ingest/vitals` to work out your normal.

## The website

Two pages: **Daily** (`/`) and **Trends** (`/trends`).

### Daily

The date at the top is one day. The page shows **that day's stats and the sleep that followed it**: the night you went to bed that evening and woke up from the next morning.

- Both are complete by the time the 09:23 run lands, so the default is the latest full day.
- Use ‹ › to go back. Each day has its own link (`/?day=2026-10-09`).

**Sleep**
- **Sleep score:** Garmin's 0 to 100 score, with ▲/▼ against your usual (the 7 nights before).
- **Bedtime → wake time.**
- **Time asleep, HRV, resting HR:** each against your usual. HRV up is usually good; resting HR up usually isn't.
- **Stage bar:** how the night split into deep, light, REM and awake.
- **Overnight recharge:** how much Body Battery the night gave back.
- **Breathing:** breaths a minute while asleep. It's usually very steady, so a jump stands out.
- **Sleep stress:** how calm your body was overnight, lower is calmer, plus how many times you woke.

**In short**
- **Recovery light:** compares HRV and resting HR with your own normal (the median of your last 30 nights).
  - Green: both normal.
  - Amber: HRV more than 15% low **or** resting HR 3+ bpm high.
  - Red: both, or HRV low two nights running. That often shows up before illness or after overdoing it.
  - It's a nudge, not a diagnosis.
- **Verdict and summary:** a one-line grade of the night, then plain sentences about what stood out. These cover time asleep, bedtime drift, deep sleep, wake-ups, HRV, resting HR and the day before.

**Day stats**
- Steps (with your goal), Body Battery low to high (plus charged and drained), stress (average and peak), active calories, distance, daytime resting HR.
- Each is compared with the 7 days before.

**This week**
- Average score, time asleep, HRV and resting HR over the last 7 nights, against the 7 nights before. One bad night doesn't tell the whole story; this does.

**Sleep stages**
- The night as a timeline: when you were in deep, light, REM or awake. Hover for exact times.

### Trends

The top section always uses all your nights. The range picker (7 days, 30 days, 90 days, All) controls everything below it.

- **Records:** best and worst night, longest sleep, averages, your current and best streak of 80+ nights, most steps.
- **What helps your sleep:** your average score the night after different kinds of day.
  - The comparisons are high vs low steps, calm vs stressful days, and early vs late bedtimes.
  - The splits use your own medians.
  - Each side needs 5+ nights before it's shown.
  - It's correlation, not proof.
- **Best night of the week:** average score for each night, named by the evening you went to bed. Friday means Friday night.

Below the picker:

- **Every chart spans the same dates:** from the start of the range (or your first night, for All) to today. A day with no data is a gap, not a shorter chart.
- **90 days and All switch to weekly averages:** one point per week (Monday to Sunday), so a year is about 52 bars instead of 365. The 7-day lines are dropped in this mode, because the weekly points are already averages.

| Chart | What it shows |
| --- | --- |
| Sleep window | One row per night (or week): a bar from falling asleep to waking. The lines mark your usual times. "Bedtime varies ±N min" is how steady your routine is. |
| Sleep score | Score per night (or weekly average) with a 7-night average line |
| Sleep debt | Each night vs your usual amount of sleep, above or below zero. The line is the running total over 7 nights. Weekly mode shows each week's total. |
| Time asleep | Hours per night with a 7-night average |
| Stage mix | Each night split into deep, light, REM and awake |
| HRV | Heart rate variability per night with a 7-night average. Higher is usually better. |
| Resting heart rate | Per night, with a 7-night average. Lower is usually better. |
| Steps | Steps per day, a 7-day average, and your goal line |
| Body Battery | Each day's lowest to highest Body Battery. A short bar high up is a well-rested day. |
| Stress | Average stress per day with a 7-day average. Lower is usually better. |

### Colours

- **Sleep stages** always use the same four colours: deep blue, light aqua, REM violet, awake orange.
- **On Trends, each measure has its own colour**, so you can tell the charts apart at a glance.
  - Score is blue, sleep window violet, time asleep and sleep debt aqua.
  - HRV is yellow, resting HR pink.
  - Steps are red, Body Battery green, stress orange.
  - Cards that sit side by side use colour pairs checked for colour-blind readers.
- **Green, amber and red ▲/▼** only mean better or worse than usual, and always come with words.

## Where to change things

| You want to | Look at |
| --- | --- |
| Change the daily run time | `worker/wrangler.jsonc` (`triggers.crons`) |
| Change what the collector reads | `collector/src/sleep_collector/garmin.py`, `parse.py` |
| Change the API | `worker/src/index.ts`, `worker/src/schema.ts` |
| Change a page or card | `web/src/App.tsx`, `web/src/components/` |
| Change a chart | `web/src/charts/` |
| Change the written summary or recovery light | `web/src/summary.ts`, `web/src/recovery.ts` |
| Change the insights | `web/src/insights.ts` |
| Change colours | `web/src/styles.css` (tokens at the top) |
| Set up from scratch | `docs/SETUP.md`, `docs/GARMIN_SETUP.md` |
