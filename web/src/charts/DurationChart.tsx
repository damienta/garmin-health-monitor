import { Bar, ComposedChart, Line, ResponsiveContainer, Tooltip } from "recharts";
import type { TrendRow } from "../api";
import { Tip } from "../components/Tooltip";
import { usePeriod } from "./period";
import { toWeeks } from "../series";
import { hm } from "../sleep";
import { cursorBand, grid, xAxis, yAxis } from "./axes";

/** Hours asleep per night as quiet columns, with the 7-night average as the ink line. */
export function DurationChart({ rows }: { rows: TrendRow[] }) {
  const period = usePeriod();
  const data = period.weekly ? toWeeks(rows, ["duration_h_7d"]) : rows;
  return (
    <>
      <ResponsiveContainer width="100%" height={220}>
        <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }} barCategoryGap="20%">
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
                  title={period.title(r.date)}
                  rows={[
                    { label: "Time asleep", value: hm((r.duration_h ?? 0) * 3600), color: "var(--c-sleep)" },
                    ...(period.weekly
                      ? []
                      : [{ label: "7-night average", value: hm((r.duration_h_7d ?? 0) * 3600), color: "var(--ink)", shape: "line" as const }]),
                  ]}
                />
              );
            }}
          />
          <Bar dataKey="duration_h" fill="var(--c-sleep)" maxBarSize={24} radius={[4, 4, 0, 0]} isAnimationActive={false} />
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
          <span className="swatch" style={{ background: "var(--c-sleep)" }} /> {period.weekly ? "Average per night" : "Time asleep"}
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
