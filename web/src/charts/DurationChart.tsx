import { Bar, ComposedChart, Line, ResponsiveContainer, Tooltip } from "recharts";
import type { TrendRow } from "../api";
import { Tip } from "../components/Tooltip";
import { longDate } from "../format";
import { hm } from "../sleep";
import { cursorBand, grid, xAxis, yAxis } from "./axes";

/** Hours asleep per night as quiet columns, with the 7-night average as the ink line. */
export function DurationChart({ rows }: { rows: TrendRow[] }) {
  return (
    <>
      <ResponsiveContainer width="100%" height={220}>
        <ComposedChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: -12 }} barCategoryGap="20%">
          {grid()}
          {xAxis()}
          {yAxis({ domain: [0, 10], ticks: [0, 2, 4, 6, 8, 10], unit: "h" })}
          <Tooltip
            cursor={cursorBand}
            content={({ active, payload }) => {
              const r = payload?.[0]?.payload as TrendRow | undefined;
              if (!active || !r) return null;
              return (
                <Tip
                  title={longDate(r.date)}
                  rows={[
                    { label: "Time asleep", value: hm((r.duration_h ?? 0) * 3600), color: "var(--bar)" },
                    { label: "7-night average", value: hm((r.duration_h_7d ?? 0) * 3600), color: "var(--ink)", shape: "line" },
                  ]}
                />
              );
            }}
          />
          <Bar dataKey="duration_h" fill="var(--bar)" maxBarSize={24} radius={[4, 4, 0, 0]} isAnimationActive={false} />
          <Line
            dataKey="duration_h_7d"
            stroke="var(--ink)"
            strokeWidth={2}
            dot={false}
            activeDot={false}
            isAnimationActive={false}
            connectNulls
          />
        </ComposedChart>
      </ResponsiveContainer>
      <div className="legend">
        <span>
          <span className="swatch" style={{ background: "var(--bar)" }} /> Time asleep
        </span>
        <span>
          <span className="swatch line" style={{ background: "var(--ink)" }} /> 7-night average
        </span>
      </div>
    </>
  );
}
