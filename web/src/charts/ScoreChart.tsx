import { ComposedChart, Line, ResponsiveContainer, Scatter, Tooltip } from "recharts";
import type { TrendRow } from "../api";
import { Tip } from "../components/Tooltip";
import { usePeriod } from "./period";
import { toWeeks } from "../series";
import { cursorLine, grid, xAxis, yAxis } from "./axes";

/** Nightly score as quiet dots, the 7-night average as the one strong line. */
export function ScoreChart({ rows }: { rows: TrendRow[] }) {
  const period = usePeriod();
  const data = period.weekly ? toWeeks(rows, ["score_7d"]) : rows;
  return (
    <>
      <ResponsiveContainer width="100%" height={260}>
        <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
          {grid()}
          {xAxis()}
          {yAxis({ domain: [40, 100], ticks: [40, 60, 80, 100] })}
          <Tooltip
            cursor={cursorLine}
            content={({ active, payload }) => {
              const row = payload?.[0]?.payload as TrendRow | undefined;
              if (!active || !row) return null;
              return (
                <Tip
                  title={period.title(row.date)}
                  rows={[
                    { label: period.weekly ? "Average score" : "Score", value: row.score != null ? Math.round(row.score) : "–", color: "var(--c-score)", shape: "dot" },
                    ...(period.weekly ? [] : [{ label: "7-night average", value: row.score_7d ?? "–", color: "var(--ink)", shape: "line" as const }]),
                  ]}
                />
              );
            }}
          />
          {period.weekly && (
            <Line dataKey="score" stroke="var(--c-score)" strokeWidth={2} dot={false} activeDot={false} isAnimationActive={false} connectNulls />
          )}
          <Scatter dataKey="score" fill="var(--c-score)" stroke="var(--surface)" strokeWidth={2} isAnimationActive={false} />
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
          <span className="swatch dot" style={{ background: "var(--c-score)" }} /> {period.weekly ? "Weekly average" : "Nightly score"}
        </span>
        {!period.weekly && (
          <span>
            <span className="swatch line" style={{ background: "var(--ink)" }} /> 7-night average
          </span>
        )}
      </div>
    </>
  );
}
