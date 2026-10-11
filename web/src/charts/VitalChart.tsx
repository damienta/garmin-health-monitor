import { ComposedChart, Line, ResponsiveContainer, Scatter, Tooltip } from "recharts";
import { Tip } from "../components/Tooltip";
import { usePeriod } from "./period";
import { toWeeks } from "../series";
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
  color,
}: {
  rows: T[];
  value: (r: T) => number | null;
  unit: string;
  label?: string;
  avgLabel?: string;
  /** The chart's own colour token, e.g. "var(--c-hrv)". */
  color: string;
}) {
  const period = usePeriod();
  const daily = rows.map((r) => ({ date: r.date, v: value(r) }));
  // Weekly: one dot per week (its average), no rolling line on top.
  const avg = period.weekly ? daily.map(() => null) : rolling7(daily, (r) => r.v);
  const data = (period.weekly ? toWeeks(daily) : daily).map((r, i) => ({
    ...r,
    avg: avg[i] == null ? null : Math.round(avg[i]! * 10) / 10,
  }));
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
                title={period.title(r.date)}
                rows={[
                  { label: period.weekly ? "Weekly average" : label, value: r.v != null ? `${Math.round(r.v)} ${unit}` : "–", color, shape: "dot" },
                  ...(period.weekly
                    ? []
                    : [{ label: avgLabel, value: r.avg != null ? `${r.avg} ${unit}` : "–", color: "var(--ink)", shape: "line" as const }]),
                ]}
              />
            );
          }}
        />
        {period.weekly && <Line dataKey="v" stroke={color} strokeWidth={2} dot={false} activeDot={false} isAnimationActive={false} connectNulls />}
        <Scatter dataKey="v" fill={color} stroke="var(--surface)" strokeWidth={2} isAnimationActive={false} />
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
