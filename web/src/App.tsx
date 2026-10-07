import { useState, type ReactNode } from "react";
import { getHealth, getNights, getTrends } from "./api";
import { DurationChart } from "./charts/DurationChart";
import { ScoreChart } from "./charts/ScoreChart";
import { StageMixChart } from "./charts/StageMixChart";
import { VitalChart } from "./charts/VitalChart";
import { Card } from "./components/Card";
import { LastNight } from "./components/LastNight";
import { RangePicker, type Range } from "./components/RangePicker";
import { ago } from "./format";
import { useLoad, type Loaded } from "./useApi";

export function App() {
  const [range, setRange] = useState<Range>(30);
  const health = useLoad(getHealth, "health");
  const trends = useLoad(() => getTrends(range), `trends-${range}`);
  const nights = useLoad(() => getNights(range), `nights-${range}`);

  return (
    <main>
      <header className="header">
        <div>
          <h1>Sleep</h1>
          <p>
            {health.kind === "ready" && health.data.last_ingest_age_h != null
              ? `Updated ${ago(health.data.last_ingest_age_h)}`
              : " "}
          </p>
        </div>
      </header>

      {health.kind === "error" && <p className="error">Couldn't reach the API: {health.message}</p>}
      {health.kind === "ready" && health.data.latest_night && <LastNight date={health.data.latest_night} />}

      <div className="section-head">
        <h2>Trends</h2>
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
    </main>
  );
}

/** Loading skeleton, error, empty state, or the chart. */
function Body<T>({
  state,
  height,
  children,
}: {
  state: Loaded<T[]>;
  height: number;
  children: (rows: T[]) => ReactNode;
}) {
  if (state.kind === "loading") return <div className="skeleton" style={{ height }} />;
  if (state.kind === "error") return <p className="error">Couldn't load data: {state.message}</p>;
  if (state.data.length === 0) return <p className="muted">No nights in this range yet.</p>;
  return <>{children(state.data)}</>;
}
