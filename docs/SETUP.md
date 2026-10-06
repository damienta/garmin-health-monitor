# Day 2 setup: go live (about 30 minutes, once)

Everything here is on a free plan that doesn't expire. Do the steps in order. Commands are for PowerShell on Windows; they work the same on macOS/Linux.

You'll make two random passwords along the way. Generate each one from the `collector` folder with:

```powershell
uv run python -c "import secrets; print(secrets.token_hex(32))"
```

That uses Python's `secrets` module, which is built for passwords.

## 1. Cloudflare: create the database and deploy the Worker

You already have a Cloudflare account from your portfolio.

```powershell
cd worker
npm ci
npx wrangler login                                  # opens the browser to authorise
```

The database already exists and its id is in `worker/wrangler.jsonc`. (It was created with `npx wrangler d1 create garmin-health-monitor`. If wrangler ever asks to add a binding to the config, answer **no**: the config already has one called `DB`.)

```powershell
npm run db:migrate                                  # creates the tables in the real database
npx wrangler deploy                                 # prints https://garmin-health-monitor.<you>.workers.dev
npx wrangler secret put INGEST_TOKEN                # paste random password #1
npx wrangler secret put READ_TOKEN                  # paste random password #2 (different)
```

Check it's alive (should print `"ok":false`, because no data yet):

```powershell
curl.exe -H "Authorization: Bearer <READ_TOKEN>" https://garmin-health-monitor.<you>.workers.dev/api/health
```

### API token for automatic deploys

Cloudflare dashboard → **My Profile → API Tokens → Create Token** → template **Edit Cloudflare Workers** → add permission **Account → D1 → Edit** → limit to your account → leave **TTL empty** (no expiry) → create. Keep the token for step 4.

Your **Account ID** is on the Cloudflare dashboard → Workers & Pages, right-hand side.

## 2. healthchecks.io: an alarm if the daily run stops

1. Sign up at https://healthchecks.io (free Hobbyist plan).
2. **Add Check** → Period **1 day**, Grace **6 hours**. Email alerts are on by default.
3. Copy the ping URL (`https://hc-ping.com/<uuid>`).

Why: GitHub emails you when a run *fails*, but not when a run *never starts* (GitHub sometimes skips scheduled runs). healthchecks.io notices silence.

## 3. Garmin tokens

You already logged in on Day 1. Print the token file:

```powershell
Get-Content $HOME\.garminconnect\garmin_tokens.json
```

Copy the whole line (it starts with `{"di_token"`). It goes into a GitHub secret in step 4 and nowhere else.

## 4. GitHub: secrets and one variable

Repo → **Settings → Secrets and variables → Actions**.

**Secrets** tab → *New repository secret*:

| Name | Value |
| --- | --- |
| `GARMIN_TOKENS` | The token file contents from step 3 |
| `INGEST_URL` | `https://garmin-health-monitor.<you>.workers.dev` |
| `INGEST_TOKEN` | Random password #1 (same as the Worker's) |
| `HEALTHCHECK_URL` | The healthchecks.io ping URL |
| `CLOUDFLARE_API_TOKEN` | The API token from step 1 |
| `CLOUDFLARE_ACCOUNT_ID` | Your Cloudflare account ID |
| `DISCORD_WEBHOOK_URL` | Optional. A Discord channel webhook (channel → Edit → Integrations → Webhooks → New → Copy URL). Morning message with last night, and a ❌ if a run fails |

**Variables** tab → *New repository variable*: `CLOUDFLARE_DEPLOY` = `true` (turns on automatic Worker deploys).

Keep random password #2 (`READ_TOKEN`) somewhere safe, like a password manager: Grafana needs it on Day 3.

## 5. First run: backfill a month

Repo → **Actions → collect → Run workflow** → days `30` → Run.

It should go green in about a minute. Then:

```powershell
curl.exe -H "Authorization: Bearer <READ_TOKEN>" "https://garmin-health-monitor.<you>.workers.dev/api/nights?days=30"
```

You should see your nights. From now on it runs by itself every day at 09:23 UTC.

## When something breaks

| Symptom | Fix |
| --- | --- |
| Email: collect failed, log says `Garmin rejected` | Tokens died. On your laptop: `uv run sleep-collector login`, paste the new file into the `GARMIN_TOKENS` secret, then **Run workflow** with **reseed** ticked |
| Email: collect failed, log says `401` from the Worker | `INGEST_TOKEN` secret doesn't match the Worker's. Set both to the same value |
| healthchecks.io alert, no GitHub failure | GitHub skipped the schedule. Run it manually; the next day re-fetches 3 days anyway |
| Email: `refresh token expires soon` | Log in again before it does (same as the first row) |
