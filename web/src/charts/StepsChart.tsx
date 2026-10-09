import { Bar, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip } from "recharts";
import type { DayRow } from "../api";
import { Tip } from "../components/Tooltip";
import { longDate } from "../format";
import { cursorBand, grid, xAxis, yAxis } from "./axes";

const fmt = (n: number | null) => (n == null ? "–" : n.toLocaleString("en-GB"));

/** Steps per day as quiet columns, the 7-day average as the ink line, the goal as a hairline. */
export function StepsChart({ rows }: { rows: DayRow[] }) {
  const goal = [...rows].reverse().find((r) => r.step_goal)?.step_goal ?? null;
  return (
    <>
      <ResponsiveContainer width="100%" height={220}>
        <ComposedChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: -12 }} barCategoryGap="20%">
          {grid()}
          {xAxis()}
          {yAxis({ tickFormatter: (v) => (v >= 1000 ? `${v / 1000}k` : String(v)) })}
          {goal && (
            <ReferenceLine
              y={goal}
              stroke="var(--muted)"
              strokeWidth={1}
              label={{ value: `Goal ${fmt(goal)}`, position: "insideTopRight", fill: "var(--muted)", fontSize: 12 }}
            />
          )}
          <Tooltip
            cursor={cursorBand}
            content={({ active, payload }) => {
              const r = payload?.[0]?.payload as DayRow | undefined;
              if (!active || !r) return null;
              return (
                <Tip
                  title={longDate(r.date)}
                  rows={[
                    { label: "Steps", value: fmt(r.steps), color: "var(--bar)" },
                    { label: "7-day average", value: fmt(r.steps_7d), color: "var(--ink)", shape: "line" },
                  ]}
                />
              );
            }}
          />
          <Bar dataKey="steps" fill="var(--bar)" maxBarSize={24} radius={[4, 4, 0, 0]} isAnimationActive={false} />
          <Line dataKey="steps_7d" stroke="var(--ink)" strokeWidth={2} dot={false} activeDot={false} isAnimationActive={false} connectNulls />
        </ComposedChart>
      </ResponsiveContainer>
      <div className="legend">
        <span>
          <span className="swatch" style={{ background: "var(--bar)" }} /> Steps
        </span>
        <span>
          <span className="swatch line" style={{ background: "var(--ink)" }} /> 7-day average
        </span>
      </div>
    </>
  );
}
