import { ComposedChart, Line, ResponsiveContainer, Scatter, Tooltip } from "recharts";
import { Tip } from "../components/Tooltip";
import { longDate } from "../format";
import { rolling7 } from "../sleep";
import { cursorLine, grid, xAxis, yAxis } from "./axes";
import { niceRange } from "./scale";

/**
 * One measure per day or night (HRV, resting HR, stress): dots plus a 7-day average.
 * Each measure gets its own chart rather than sharing one with two y-axes.
 */
export function VitalChart<T extends { date: string }>({
  rows,
  value,
  unit,
  label = "Night",
  avgLabel = "7-night average",
}: {
  rows: T[];
  value: (r: T) => number | null;
  unit: string;
  label?: string;
  avgLabel?: string;
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
                  { label, value: r.v != null ? `${Math.round(r.v)} ${unit}` : "–", color: "var(--muted)", shape: "dot" },
                  { label: avgLabel, value: r.avg != null ? `${r.avg} ${unit}` : "–", color: "var(--ink)", shape: "line" },
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
