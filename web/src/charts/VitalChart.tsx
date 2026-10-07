import { ComposedChart, Line, ResponsiveContainer, Scatter, Tooltip } from "recharts";
import type { TrendRow } from "../api";
import { Tip } from "../components/Tooltip";
import { longDate } from "../format";
import { rolling7 } from "../sleep";
import { cursorLine, grid, xAxis, yAxis } from "./axes";
import { niceRange } from "./scale";

/**
 * One vital (HRV or resting HR): nightly dots plus a 7-night average. HRV and resting HR
 * get a chart each rather than sharing one with two y-axes.
 */
export function VitalChart({
  rows,
  value,
  unit,
}: {
  rows: TrendRow[];
  value: (r: TrendRow) => number | null;
  unit: string;
}) {
  const avg = rolling7(rows, value);
  const data = rows.map((r, i) => ({ date: r.date, v: value(r), avg: avg[i] == null ? null : Math.round(avg[i]! * 10) / 10 }));
  return (
    <ResponsiveContainer width="100%" height={200}>
      <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
        {grid()}
        {xAxis()}
        {yAxis(niceRange(data.map((d) => d.v)))}
        <Tooltip
          cursor={cursorLine}
          content={({ active, payload }) => {
            const r = payload?.[0]?.payload as (typeof data)[number] | undefined;
            if (!active || !r) return null;
            return (
              <Tip
                title={longDate(r.date)}
                rows={[
                  { label: "Night", value: r.v != null ? `${Math.round(r.v)} ${unit}` : "–", color: "var(--muted)", shape: "dot" },
                  { label: "7-night average", value: r.avg != null ? `${r.avg} ${unit}` : "–", color: "var(--ink)", shape: "line" },
                ]}
              />
            );
          }}
        />
        <Scatter dataKey="v" fill="var(--muted)" stroke="var(--surface)" strokeWidth={2} isAnimationActive={false} />
        <Line
          dataKey="avg"
          stroke="var(--ink)"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, fill: "var(--ink)", stroke: "var(--surface)", strokeWidth: 2 }}
          isAnimationActive={false}
          connectNulls
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
