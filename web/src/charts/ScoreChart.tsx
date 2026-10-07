import { CartesianGrid, ComposedChart, Line, ResponsiveContainer, Scatter, Tooltip, XAxis, YAxis } from "recharts";
import type { TrendRow } from "../api";
import { Tip } from "../components/Tooltip";
import { longDate, shortDate } from "../format";

/** Nightly score as quiet dots, the 7-night average as the one strong line. */
export function ScoreChart({ rows }: { rows: TrendRow[] }) {
  return (
    <>
      <ResponsiveContainer width="100%" height={260}>
        <ComposedChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
          <CartesianGrid stroke="var(--grid)" vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={shortDate}
            stroke="var(--axis)"
            tick={{ fill: "var(--muted)", fontSize: 12 }}
            tickLine={false}
            minTickGap={32}
          />
          <YAxis
            domain={[40, 100]}
            ticks={[40, 60, 80, 100]}
            stroke="var(--axis)"
            tick={{ fill: "var(--muted)", fontSize: 12 }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            cursor={{ stroke: "var(--axis)", strokeWidth: 1 }}
            content={({ active, payload }) => {
              const row = payload?.[0]?.payload as TrendRow | undefined;
              if (!active || !row) return null;
              return (
                <Tip
                  title={longDate(row.date)}
                  rows={[
                    { label: "Score", value: row.score ?? "–", color: "var(--muted)", shape: "dot" },
                    { label: "7-night average", value: row.score_7d ?? "–", color: "var(--ink)", shape: "line" },
                  ]}
                />
              );
            }}
          />
          <Scatter dataKey="score" fill="var(--muted)" stroke="var(--surface)" strokeWidth={2} isAnimationActive={false} />
          <Line
            dataKey="score_7d"
            stroke="var(--ink)"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            dot={false}
            activeDot={{ r: 4, fill: "var(--ink)", stroke: "var(--surface)", strokeWidth: 2 }}
            isAnimationActive={false}
            connectNulls
          />
        </ComposedChart>
      </ResponsiveContainer>
      <div className="legend">
        <span>
          <span className="swatch dot" style={{ background: "var(--muted)" }} /> Nightly score
        </span>
        <span>
          <span className="swatch line" style={{ background: "var(--ink)" }} /> 7-night average
        </span>
      </div>
    </>
  );
}
