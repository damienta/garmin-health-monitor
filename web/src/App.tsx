import { useEffect, useState, type ReactNode } from "react";
import { type DayRow, getDays, getHealth, getNights, getTrends, type NightRow, type TrendRow } from "./api";
import { BedtimeChart } from "./charts/BedtimeChart";
import { bedtimeSpread } from "./charts/bedtime";
import { BodyBatteryChart } from "./charts/BodyBatteryChart";
import { DurationChart } from "./charts/DurationChart";
import { WeeklyContext } from "./charts/period";
import { WeekdayChart } from "./charts/WeekdayChart";
import { ScoreChart } from "./charts/ScoreChart";
import { debtText, SleepDebtChart } from "./charts/SleepDebtChart";
import { StageMixChart } from "./charts/StageMixChart";
import { StepsChart } from "./charts/StepsChart";
import { VitalChart } from "./charts/VitalChart";
import { Card } from "./components/Card";
import { Daily } from "./components/Daily";
import { Nav } from "./components/Nav";
import { RangePicker, rangeText, type Range } from "./components/RangePicker";
import { RecordsCard } from "./components/RecordsCard";
import { WhatHelps } from "./components/WhatHelps";
import { whatHelps } from "./insights";
import { useLoad, type Loaded } from "./useApi";
import { useRoute } from "./useRoute";
import { addDays, padDates, WEEKLY_FROM } from "./series";
import { dayParam } from "./routes";
import { nextDate, previousDate } from "./day";
import { longDate } from "./format";

export function App() {
  const page = useRoute();
  return (
    <main>
      <Nav page={page} />
      {page === "daily" ? <DailyPage /> : <AllTime />}
    </main>
  );
}

/**
 * The Daily page. Defaults to the latest full day: the day before the latest night, so
 * both the day's stats and the sleep after it are complete. ?day= picks another day.
 */
function DailyPage() {
  const health = useLoad(getHealth, "health");
  const [day, setDay] = useState<string | null>(() => dayParam(window.location.search));
  useEffect(() => {
    const onPop = () => setDay(dayParam(window.location.search));
    // Back/forward, and the Daily link in the nav (which clears ?day=).
    window.addEventListener("popstate", onPop);
    window.addEventListener("navigate-page", onPop);
    return () => {
      window.removeEventListener("popstate", onPop);
      window.removeEventListener("navigate-page", onPop);
    };
  }, []);
  if (health.kind === "loading") return <div className="skeleton" style={{ height: 320 }} />;
  if (health.kind === "error") return <p className="error">Couldn't reach the API: {health.message}</p>;
  if (!health.data.latest_night) return <p className="muted">No nights yet. They appear after the first daily run.</p>;
  const latest = previousDate(health.data.latest_night);
  const shown = day && day <= latest ? day : latest;
  const pick = (d: string) => {
    window.history.pushState(null, "", d === latest ? "/" : `/?day=${d}`);
    setDay(d === latest ? null : d);
  };
  return (
    <>
      <div className="section-head">
        <div className="segmented daypick" role="group" aria-label="Day">
          <button type="button" onClick={() => pick(previousDate(shown))} aria-label="Previous day">
            ‹
          </button>
          <span className="daypick-date">{longDate(shown)}</span>
          <button type="button" onClick={() => pick(nextDate(shown))} disabled={shown >= latest} aria-label="Next day">
            ›
          </button>
        </div>
        {shown !== latest && (
          <button type="button" className="linkish" onClick={() => pick(latest)}>
            Latest
          </button>
        )}
      </div>
      <Daily key={shown} day={shown} />
    </>
  );
}

function AllTime() {
  const [range, setRange] = useState<Range>(30);
  // Records and insights always look at everything, whatever the range picker says.
  const allNights = useLoad(() => getNights(3650), "nights-all");
  const allDays = useLoad(() => getDays(3650).catch(() => []), "days-all");
  const allTrends = useLoad(() => getTrends(3650), "trends-all");
  const insightsReady = allTrends.kind === "ready" && allDays.kind === "ready";
  const trends = useLoad(() => getTrends(range), `trends-${range}`);
  const nights = useLoad(() => getNights(range), `nights-${range}`);
  const days = useLoad(() => getDays(range), `days-${range}`);

  // Every chart spans the same dates: the range's first day (or, for All, your first
  // night) up to today. Days with no data become gaps instead of shortening a chart.
  const to = new Date().toISOString().slice(0, 10);
  const firstNight = allTrends.kind === "ready" && allTrends.data.length ? allTrends.data[0].date : to;
  const from = range === 3650 ? firstNight : addDays(to, -(range - 1));
  const span = <T extends { date: string }>(state: Loaded<T[]>, empty: (date: string) => T): Loaded<T[]> =>
    state.kind === "ready" && state.data.length ? { kind: "ready", data: padDates(state.data, from, to, empty) } : state;
  const weekly = range >= WEEKLY_FROM;
  const sub = <span className="sub">{rangeText(range)}{weekly ? ", weekly averages" : ""}</span>;
  const trendRows = span(trends, emptyTrend);
  const nightRows = span(nights, emptyNight);
  const dayRows = span(days, emptyDay);

  return (
    <>
      <Card title="Records" delay={60} aside={<span className="sub">All nights</span>}>
        {allNights.kind === "loading" && <div className="skeleton" style={{ height: 140 }} />}
        {allNights.kind === "error" && <p className="error">Couldn't load data: {allNights.message}</p>}
        {allNights.kind === "ready" && (
          <RecordsCard nights={allNights.data} days={allDays.kind === "ready" ? allDays.data : []} />
        )}
      </Card>

      <div className="grid-2">
        <Card title="What helps your sleep" delay={90} aside={<span className="sub">All nights</span>}>
          {allTrends.kind === "error" && <p className="error">Couldn't load data: {allTrends.message}</p>}
          {allTrends.kind !== "error" && !insightsReady && <div className="skeleton" style={{ height: 220 }} />}
          {insightsReady && <WhatHelps items={whatHelps(allTrends.data, allDays.data)} />}
        </Card>
        <Card title="Best night of the week" delay={120} aside={<span className="sub">All nights</span>}>
          {allTrends.kind === "error" && <p className="error">Couldn't load data: {allTrends.message}</p>}
          {allTrends.kind === "loading" && <div className="skeleton" style={{ height: 220 }} />}
          {allTrends.kind === "ready" && <WeekdayChart rows={allTrends.data} />}
        </Card>
      </div>

      <div className="section-head">
        <RangePicker value={range} onChange={setRange} />
      </div>

      <WeeklyContext.Provider value={weekly}>
        <Card
          title="Sleep window"
          delay={140}
          aside={
            <span className="sub">
              {nights.kind === "ready" && bedtimeSpread(nights.data) != null
                ? `Bedtime varies ±${bedtimeSpread(nights.data)} min`
                : rangeText(range)}
            </span>
          }
        >
          <Body state={nightRows} height={300}>{(rows) => <BedtimeChart rows={rows} />}</Body>
        </Card>

        <Card title="Sleep score" delay={180} aside={sub}>
          <Body state={trendRows} height={260}>{(rows) => <ScoreChart rows={rows} />}</Body>
        </Card>

        <Card
          title="Sleep debt"
          delay={200}
          aside={<span className="sub">{trends.kind === "ready" && !weekly ? debtText(trends.data) || rangeText(range) : rangeText(range)}</span>}
        >
          <Body state={trendRows} height={220}>{(rows) => <SleepDebtChart rows={rows} />}</Body>
        </Card>

        <div className="grid-2">
          <Card title="Time asleep" delay={220}>
            <Body state={trendRows} height={220}>{(rows) => <DurationChart rows={rows} />}</Body>
          </Card>
          <Card title="Stage mix" delay={260}>
            <Body state={nightRows} height={240}>{(rows) => <StageMixChart rows={rows} />}</Body>
          </Card>
          <Card title="HRV" delay={300} aside={<span className="sub">Higher is usually better</span>}>
            <Body state={trendRows} height={200}>
              {(rows) => <VitalChart rows={rows} value={(r) => r.hrv_avg} unit="ms" color="var(--c-hrv)" />}
            </Body>
          </Card>
          <Card title="Resting heart rate" delay={340} aside={<span className="sub">Lower is usually better</span>}>
            <Body state={trendRows} height={200}>
              {(rows) => <VitalChart rows={rows} value={(r) => r.resting_hr} unit="bpm" color="var(--c-rhr)" />}
            </Body>
          </Card>
        </div>

        <div className="grid-2">
          <Card title="Steps" delay={380}>
            <Body state={dayRows} height={220} empty="No activity data in this range yet.">{(rows) => <StepsChart rows={rows} />}</Body>
          </Card>
          <Card title="Body Battery" delay={420} aside={<span className="sub">Daily low to high</span>}>
            <Body state={dayRows} height={220} empty="No activity data in this range yet.">{(rows) => <BodyBatteryChart rows={rows} />}</Body>
          </Card>
        </div>

        <Card title="Stress" delay={460} aside={<span className="sub">Lower is usually better</span>}>
          <Body state={dayRows} height={200} empty="No activity data in this range yet.">
            {(rows) => (
              <VitalChart rows={rows} value={(r) => r.stress_avg} unit="" label="Day" avgLabel="7-day average" color="var(--c-stress)" />
            )}
          </Body>
        </Card>
      </WeeklyContext.Provider>
    </>
  );
}

// Placeholder rows for days with no data, so every chart spans the same dates.
const emptyTrend = (date: string): TrendRow => ({
  date,
  time: 0,
  score: null,
  score_7d: null,
  duration_h: null,
  duration_h_7d: null,
  hrv_avg: null,
  hrv_7d: null,
  resting_hr: null,
  bedtime_min: null,
});
const emptyNight = (date: string): NightRow =>
  ({ date, start_ts: 0, end_ts: 0, tz_offset_min: 0, score: null, bedtime_min: null, duration_s: 0, deep_s: null, light_s: null, rem_s: null, awake_s: null });
const emptyDay = (date: string): DayRow =>
  ({ date, time: 0, steps: null, step_goal: null, steps_7d: null, distance_m: null, active_kcal: null, moderate_min: null, vigorous_min: null, stress_avg: null, stress_max: null, bb_high: null, bb_low: null, bb_charged: null, bb_drained: null, resting_hr: null });

/** Loading skeleton, error, empty state, or the chart. */
function Body<T>({
  state,
  height,
  empty = "No nights in this range yet.",
  children,
}: {
  state: Loaded<T[]>;
  height: number;
  empty?: string;
  children: (rows: T[]) => ReactNode;
}) {
  if (state.kind === "loading") return <div className="skeleton" style={{ height }} />;
  if (state.kind === "error") return <p className="error">Couldn't load data: {state.message}</p>;
  if (state.data.length === 0) return <p className="muted">{empty}</p>;
  return <>{children(state.data)}</>;
}
