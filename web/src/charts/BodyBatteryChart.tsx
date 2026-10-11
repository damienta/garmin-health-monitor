import { Bar, BarChart, ResponsiveContainer, Tooltip } from "recharts";
import type { DayRow } from "../api";
import { Tip } from "../components/Tooltip";
import { usePeriod } from "./period";
import { toWeeks } from "../series";
import { cursorBand, grid, xAxis, yAxis } from "./axes";

/**
 * Body Battery as one bar per day running from its lowest to its highest value, so a
 * short bar high up is a well-rested day and a long bar reaching low is a draining one.
 */
export function BodyBatteryChart({ rows }: { rows: DayRow[] }) {
  const period = usePeriod();
  const shaped = period.weekly ? toWeeks(rows, ["steps_7d"]) : rows;
  const r0 = (v: number | null) => (v == null ? null : Math.round(v));
  const data = shaped.map((r) => ({
    ...r,
    range: r.bb_low != null && r.bb_high != null ? [r.bb_low, r.bb_high] : null,
  }));
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }} barCategoryGap="20%">
        {grid()}
        {xAxis()}
        {yAxis({ domain: [0, 100], ticks: [0, 25, 50, 75, 100] })}
        <Tooltip
          cursor={cursorBand}
          content={({ active, payload }) => {
            const r = payload?.[0]?.payload as DayRow | undefined;
            if (!active || !r) return null;
            return (
              <Tip
                title={period.title(r.date)}
                rows={[
                  { label: period.weekly ? "Average high" : "Highest", value: r0(r.bb_high) ?? "–" },
                  { label: period.weekly ? "Average low" : "Lowest", value: r0(r.bb_low) ?? "–" },
                  { label: "Charged", value: r.bb_charged != null ? `+${r0(r.bb_charged)}` : "–" },
                  { label: "Drained", value: r.bb_drained != null ? `−${r0(r.bb_drained)}` : "–" },
                ]}
              />
            );
          }}
        />
        <Bar dataKey="range" fill="var(--c-bb)" maxBarSize={24} radius={4} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}
