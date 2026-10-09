import { useState, type ReactNode } from "react";
import { getActivities, getDays, getHealth, getNights, getTrends } from "./api";
import { BodyBatteryChart } from "./charts/BodyBatteryChart";
import { DurationChart } from "./charts/DurationChart";
import { IntensityChart } from "./charts/IntensityChart";
import { ScoreChart } from "./charts/ScoreChart";
import { StageMixChart } from "./charts/StageMixChart";
import { StepsChart } from "./charts/StepsChart";
import { VitalChart } from "./charts/VitalChart";
import { Card } from "./components/Card";
import { LastNight } from "./components/LastNight";
import { Nav } from "./components/Nav";
import { RangePicker, type Range } from "./components/RangePicker";
import { Workouts } from "./components/Workouts";
import { useLoad, type Loaded } from "./useApi";
import { useRoute } from "./useRoute";

export function App() {
  const page = useRoute();
  return (
    <main>
      <Nav page={page} />
      {page === "night" ? <LastNightPage /> : <AllTime />}
    </main>
  );
}

function LastNightPage() {
  const health = useLoad(getHealth, "health");
  if (health.kind === "loading") return <div className="skeleton" style={{ height: 320 }} />;
  if (health.kind === "error") return <p className="error">Couldn't reach the API: {health.message}</p>;
  if (!health.data.latest_night) return <p className="muted">No nights yet. They appear after the first daily run.</p>;
  return <LastNight date={health.data.latest_night} />;
}

function AllTime() {
  const [range, setRange] = useState<Range>(30);
  const trends = useLoad(() => getTrends(range), `trends-${range}`);
  const nights = useLoad(() => getNights(range), `nights-${range}`);
  const days = useLoad(() => getDays(range), `days-${range}`);
  const activities = useLoad(() => getActivities(range), `activities-${range}`);

  return (
    <>
      <div className="section-head">
        <RangePicker value={range} onChange={setRange} />
      </div>

      <Card title="Sleep score" delay={180} aside={<span className="sub">Last {range} nights</span>}>
        <Body state={trends} height={260}>{(rows) => <ScoreChart rows={rows} />}</Body>
      </Card>

      <div className="grid-2">
        <Card title="Time asleep" delay={220}>
          <Body state={trends} height={220}>{(rows) => <DurationChart rows={rows} />}</Body>
        </Card>
        <Card title="Stage mix" delay={260}>
          <Body state={nights} height={240}>{(rows) => <StageMixChart rows={rows} />}</Body>
        </Card>
        <Card title="HRV" delay={300} aside={<span className="sub">Higher is usually better</span>}>
          <Body state={trends} height={200}>
            {(rows) => <VitalChart rows={rows} value={(r) => r.hrv_avg} unit="ms" />}
          </Body>
        </Card>
        <Card title="Resting heart rate" delay={340} aside={<span className="sub">Lower is usually better</span>}>
          <Body state={trends} height={200}>
            {(rows) => <VitalChart rows={rows} value={(r) => r.resting_hr} unit="bpm" />}
          </Body>
        </Card>
      </div>

      <div className="grid-2">
        <Card title="Steps" delay={380}>
          <Body state={days} height={220} empty="No activity data in this range yet.">{(rows) => <StepsChart rows={rows} />}</Body>
        </Card>
        <Card title="Body Battery" delay={420} aside={<span className="sub">Daily low to high</span>}>
          <Body state={days} height={220} empty="No activity data in this range yet.">{(rows) => <BodyBatteryChart rows={rows} />}</Body>
        </Card>
        <Card title="Stress" delay={460} aside={<span className="sub">Lower is usually better</span>}>
          <Body state={days} height={200} empty="No activity data in this range yet.">
            {(rows) => <VitalChart rows={rows} value={(r) => r.stress_avg} unit="" label="Day" avgLabel="7-day average" />}
          </Body>
        </Card>
        <Card title="Intensity minutes" delay={500}>
          <Body state={days} height={200} empty="No activity data in this range yet.">
            {(rows) => <IntensityChart rows={rows} />}
          </Body>
        </Card>
      </div>

      <Card title="Workouts" delay={540} aside={<span className="sub">Latest 12 in range</span>}>
        <Body state={activities} height={200} empty="No workouts in this range.">
          {(rows) => <Workouts rows={rows} />}
        </Body>
      </Card>
    </>
  );
}

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
