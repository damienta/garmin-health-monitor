# Grafana

Grafana Cloud (free) shows charts from the same API as the website. There are two dashboards:

| Dashboard | File | What it answers |
| --- | --- | --- |
| **Sleep** | `grafana/sleep-dashboard.json` | How did I sleep? Last night's numbers, stages and trends. |
| **System health** | `grafana/system-dashboard.json` | Is the system working? When data last arrived, how many runs this week, every upload. |

Grafana never stores your data. Each panel asks the API when you open the dashboard, using the
**Infinity** plugin and your `READ_TOKEN`.

## Import a dashboard

You need the Infinity data source set up once (base URL = the API Worker, Bearer token = `READ_TOKEN`).
If the Sleep dashboard already works, that's done.

1. Grafana → **Dashboards → New → Import**.
2. **Upload dashboard JSON file** → pick `grafana/system-dashboard.json` (download it from GitHub first: open the file → **Download raw file**).
3. Under **Infinity**, choose your existing Infinity data source → **Import**.

## What the System health panels mean

| Panel | Healthy | Not healthy |
| --- | --- | --- |
| Hours since last data | Green, under 26 hours | Orange 26–30, red over 30: the daily run failed or the Garmin sign-in needs renewing |
| Latest night | Today's date | An older date: the watch hasn't synced, or the run didn't happen |
| Uploads in the last 7 days | Green at 7 or more | Fewer means days were missed |
| Last upload from | `github-actions` | `local` means the last data came from your laptop |
| Nights saved per upload | A bar every day (3 nights, 14 on Sundays) | Gaps are days with no run |
| Recent uploads | A row per day | Missing days |

## Alert to Discord when data stops arriving

1. **Alerting → Contact points**: check your Discord contact point exists (it does if the stale-data alert already pings you).
2. **Alerting → Alert rules → New alert rule**. Name: `No sleep data`.
3. Query: data source **Infinity**, Type **JSON**, Parser **Backend**, Source **URL**, URL `/api/health`.
   Add a column: selector `last_ingest_age_h`, type **Number**.
4. Expressions: **Reduce** → Last. **Threshold** → is above `26`.
5. Folder: any. Evaluation group: new, every **1h**. Pending period: **0s**.
6. Contact point: **Discord**. **Save rule and exit**.

If you already have the old "stale > 30h" alert, edit its threshold to 26 instead of adding a second one.
