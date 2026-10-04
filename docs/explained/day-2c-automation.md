# Day 2c explained: running it every day without you

Day 2a stores data and Day 2b sends it. Day 2c makes GitHub run `sleep-collector run` every morning, deploys the Worker when its code changes, and tells you when something breaks.

## The big picture

```text
every day 09:23 UTC
GitHub Actions (collect.yml) on a fresh Linux machine
  1. download the code, install Python packages with uv
  2. get the Garmin token file: Actions cache (newest), or GARMIN_TOKENS secret (first run)
  3. uv run sleep-collector run --days 3   → refresh, fetch, push to the Worker
  4. check-tokens: warn if the refresh token expires within 14 days
  5. save the token file back to the Actions cache (even if a step failed)
  6. ping healthchecks.io: success or fail
```

## Words you'll see

| Word | Meaning |
| --- | --- |
| **GitHub Actions** | GitHub runs scripts for you on its machines. Free private-repo allowance: 2,000 minutes a month. This job uses about 1 minute a day |
| **Workflow** | A `.yml` file in `.github/workflows/` describing when to run and which steps |
| **cron** | A schedule written as 5 fields: minute, hour, day of month, month, weekday. `23 9 * * *` = 09:23 every day (UTC) |
| **Secret** | An encrypted value stored in GitHub. Steps can use it, but logs hide it and nobody can read it back |
| **Actions cache** | A small private file store GitHub keeps between runs. Entries unused for 7 days are deleted; a daily run keeps it alive |
| **Dead man's switch** | An alarm that goes off when something *stops* happening |

## `.github/workflows/collect.yml`, step by step

**Triggers (`on:`)**
- `schedule: cron "23 9 * * *"`: every day at 09:23 UTC (10:23 UK summer time).
- `workflow_dispatch`: a **Run workflow** button with two options:
  - `days`: how far back to fetch (use 30 the first time to load a month).
  - `reseed`: use the secret instead of the cache. Tick it after you log in again on your laptop.

**`concurrency: collect`**: never two runs at once, so two runs can't fight over the token file.

**Steps:**

| Step | What it does |
| --- | --- |
| Checkout, setup-uv | Downloads the repo and installs uv (with a cache so it's fast) |
| **Restore Garmin tokens** | Looks in the Actions cache for the newest token file |
| **Seed tokens from secret** | Only if the cache had nothing (first run) or you ticked `reseed`: writes the `GARMIN_TOKENS` secret to the token file |
| **Fetch and push** | `uv run sleep-collector run --days 3`, with `INGEST_URL` and `INGEST_TOKEN` from secrets. On Sundays it fetches 14 days, to catch anything older that was missed |
| **Check token expiry** | Runs `inspect-tokens`, then `check-tokens`. Data is already saved by now; this step only fails (and emails you) if the refresh token is close to expiring |
| **Save Garmin tokens** | Saves the token file to the cache under a new name. `if: always()` means it runs **even when an earlier step failed**, so a refreshed token is never lost |
| **Ping healthchecks.io** | Calls your ping URL on success, or `<url>/fail` on failure |

**Why the cache and the secret:** a workflow can't easily update its own secret. The secret is the starting copy; after that, each run passes the newest token file to the next through the cache. Your Day 1 test showed Garmin didn't rotate the refresh token, so the secret alone would probably work. The cache is a safety net in case Garmin changes that.

**Why fetch 3 days, not 1:** if your watch syncs late, a run is skipped, or it fails, tomorrow's run picks up the missing night. Re-sending a night is harmless because the Worker upserts.

## `.github/workflows/deploy.yml`

Runs when Worker code changes on `main` (or when you click **Run workflow**):

1. Install packages and run the Worker tests again.
2. `wrangler d1 migrations apply --remote`: apply any new database migrations **first**.
3. `wrangler deploy`: publish the new code.

Migrations go first so new code never runs against an old table layout. The whole job is **off** until you set the repo variable `CLOUDFLARE_DEPLOY=true`, so it doesn't fail before Cloudflare is set up.

## `.github/dependabot.yml`

Dependabot opens PRs when your dependencies have new versions: Python packages weekly, Worker packages and GitHub Actions monthly. CI tests each PR, and you decide whether to merge. This matters most for `garminconnect`: if Garmin breaks the library and a fix is released, you get a PR for it.

## How you'll know it's working

| Signal | Where |
| --- | --- |
| Green tick on the **collect** workflow each morning | GitHub → Actions |
| `"ok": true` from `/api/health` | Your Worker URL |
| No emails | GitHub only emails on failure; healthchecks.io only emails on silence or `/fail` |

## How you'll know it's broken

| What happened | What tells you |
| --- | --- |
| Garmin tokens died | GitHub failure email + healthchecks.io `fail` |
| Refresh token expiring soon (if Garmin shows its expiry) | GitHub failure email from the check step, 14 days early |
| Worker down or wrong token | GitHub failure email |
| GitHub silently skipped the schedule | healthchecks.io email after 30 hours of silence |

Fixes for each are in [`docs/SETUP.md`](../SETUP.md#when-something-breaks).
