import { useEffect, useState } from "react";
import { getTrends, type TrendRow } from "./api";
import { TrendsChart } from "./TrendsChart";

const DAYS = 30;

type State = { kind: "loading" } | { kind: "error"; message: string } | { kind: "ready"; rows: TrendRow[] };

export function App() {
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    getTrends(DAYS)
      .then((rows) => setState({ kind: "ready", rows }))
      .catch((e: unknown) => setState({ kind: "error", message: String(e) }));
  }, []);

  return (
    <main>
      <h1>Sleep</h1>
      <section className="card">
        <h2>Sleep score, last {DAYS} days</h2>
        {state.kind === "loading" && <p className="muted">Loading…</p>}
        {state.kind === "error" && <p className="error">Couldn't load data: {state.message}</p>}
        {state.kind === "ready" && state.rows.length === 0 && <p className="muted">No nights yet.</p>}
        {state.kind === "ready" && state.rows.length > 0 && <TrendsChart rows={state.rows} />}
      </section>
    </main>
  );
}
