import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { TrendRow } from "./api";
import { shortDate } from "./format";

/** Nightly sleep score as dots, with the 7-night average as a line. */
export function TrendsChart({ rows }: { rows: TrendRow[] }) {
  return (
    <ResponsiveContainer width="100%" height={320}>
      <LineChart data={rows} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
        <CartesianGrid stroke="var(--grid)" vertical={false} />
        <XAxis dataKey="date" tickFormatter={shortDate} stroke="var(--muted)" minTickGap={24} />
        <YAxis domain={[0, 100]} stroke="var(--muted)" width={36} />
        <Tooltip
          labelFormatter={(d) => shortDate(String(d))}
          contentStyle={{ background: "var(--card)", border: "1px solid var(--grid)" }}
        />
        <Legend />
        <Line
          name="Score"
          dataKey="score"
          stroke="var(--accent-soft)"
          strokeWidth={0}
          dot={{ r: 3, fill: "var(--accent-soft)" }}
          isAnimationActive={false}
          connectNulls
        />
        <Line
          name="7-night average"
          dataKey="score_7d"
          stroke="var(--accent)"
          strokeWidth={2.5}
          dot={false}
          isAnimationActive={false}
          connectNulls
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
