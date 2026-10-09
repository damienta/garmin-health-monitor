import { Bar, BarChart, ResponsiveContainer, Tooltip } from "recharts";
import type { DayRow } from "../api";
import { Tip } from "../components/Tooltip";
import { longDate } from "../format";
import { cursorBand, grid, xAxis, yAxis } from "./axes";

/**
 * Body Battery as one bar per day running from its lowest to its highest value, so a
 * short bar high up is a well-rested day and a long bar reaching low is a draining one.
 */
export function BodyBatteryChart({ rows }: { rows: DayRow[] }) {
  const data = rows.map((r) => ({
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
                title={longDate(r.date)}
                rows={[
                  { label: "Highest", value: r.bb_high ?? "–", color: "var(--ink)" },
                  { label: "Lowest", value: r.bb_low ?? "–", color: "var(--bar)" },
                  { label: "Charged", value: r.bb_charged != null ? `+${r.bb_charged}` : "–" },
                  { label: "Drained", value: r.bb_drained != null ? `−${r.bb_drained}` : "–" },
                ]}
              />
            );
          }}
        />
        <Bar dataKey="range" fill="var(--bar)" maxBarSize={24} radius={4} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}
