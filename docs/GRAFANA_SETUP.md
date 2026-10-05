# Day 3 setup: Grafana dashboard (about 20 minutes, in the browser)

Grafana Cloud's free tier is enough (no card needed). You'll need your Worker URL and your **READ_TOKEN** (the read password, not the ingest one).

## 1. Create a Grafana Cloud account

1. Go to https://grafana.com/auth/sign-up/create-user and sign up (email, or Sign in with GitHub).
2. When asked for a **stack** name, pick something short like `damienta`. Your Grafana will live at `https://damienta.grafana.net`.
3. Pick a region close to you (an EU region for the UK).
4. Wait a minute for the stack to start, then open it. You'll land on the Grafana home page.

If it shows an onboarding wizard ("What would you like to monitor?"), skip it.

## 2. Install the Infinity plugin

Infinity lets Grafana read JSON from any web API, which is what your Worker returns.

1. Left menu: **Administration → Plugins and data → Plugins**.
2. Search **Infinity**, open it (by Grafana Labs), click **Install**.

## 3. Connect Grafana to your Worker

1. Left menu: **Connections → Data sources → Add new data source**, choose **Infinity**.
2. Name: `garmin-health-monitor`.
3. **Authentication** section:
   - Auth type: **Bearer Token**
   - Token: paste your **READ_TOKEN**
   - **Allowed hosts**: add `https://garmin-health-monitor.tadamien8.workers.dev`
4. **URL, Headers & Params** section:
   - **Base URL**: `https://garmin-health-monitor.tadamien8.workers.dev`
5. Click **Save & test**.

The dashboard's queries are paths like `/api/trends`; Infinity puts the Base URL in front and adds the token to every request.

## 4. Import the dashboard

1. Download `grafana/sleep-dashboard.json` from the repo (open it on GitHub → **Download raw file**), or use your local copy after `git pull`.
2. Left menu: **Dashboards → New → Import**.
3. Upload the file. For **Infinity (garmin-health-monitor Worker)**, pick the data source from step 3.
4. Click **Import**.

You should see:

| Row | Panels |
| --- | --- |
| Top | Last night's sleep score, time asleep, HRV, resting HR, deep sleep, and **Collector** (hours since data last arrived) |
| Middle | Last night's sleep stages as a timeline |
| Bottom | Sleep score, time asleep, and HRV + resting HR over time, each with a 7-night average |

The time picker (top right, default **Last 30 days**) controls the trend charts.

## 5. Alert if data stops arriving (optional, recommended)

1. On the **Collector** panel: hover → **⋮ menu → More… → New alert rule**.
2. Under the condition, set **Threshold → Is above → 30**.
3. Folder: create one called `Sleep`. Evaluation group: create one called `daily`, every **1h**.
4. Contact point: the default one emails your Grafana account address.
5. **Save rule and exit**.

Now you get an email if the daily job hasn't delivered anything for 30 hours. It overlaps with healthchecks.io on purpose: that one watches the GitHub job, this one watches the data actually landing.

## Troubleshooting

| Problem | Fix |
| --- | --- |
| Panels say **No data** or show 401 | The data source token is wrong: paste the READ_TOKEN again in step 3 |
| Error mentioning **allowed hosts** | Add the Worker URL to Allowed hosts in step 3, exactly as above |
| Trend charts empty, top tiles fine | Widen the time range (top right) to cover your data |
| Stat tiles empty | No night in the last 3 days yet: check the **collect** workflow in GitHub Actions |
| Collector tile red | The daily job hasn't delivered for 30 hours: check GitHub Actions and `docs/SETUP.md` |
