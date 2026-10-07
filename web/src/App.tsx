import { useState } from "react";
import { getHealth, getTrends } from "./api";
import { ScoreChart } from "./charts/ScoreChart";
import { Card } from "./components/Card";
import { LastNight } from "./components/LastNight";
import { RangePicker, type Range } from "./components/RangePicker";
import { ago } from "./format";
import { useLoad } from "./useApi";

export function App() {
  const [range, setRange] = useState<Range>(30);
  const health = useLoad(getHealth, "health");
  const trends = useLoad(() => getTrends(range), `trends-${range}`);

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
        <RangePicker value={range} onChange={setRange} />
      </header>

      {health.kind === "ready" && health.data.latest_night && <LastNight date={health.data.latest_night} />}

      <Card title="Sleep score" delay={180} aside={<span className="sub">Last {range} nights</span>}>
        {trends.kind === "loading" && <div className="skeleton" style={{ height: 260 }} />}
        {trends.kind === "error" && <p className="error">Couldn't load data: {trends.message}</p>}
        {trends.kind === "ready" && trends.data.length === 0 && <p className="muted">No nights in this range yet.</p>}
        {trends.kind === "ready" && trends.data.length > 0 && <ScoreChart rows={trends.data} />}
      </Card>
    </main>
  );
}
