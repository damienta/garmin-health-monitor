import { Bar, BarChart, LabelList, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { Tip } from "../components/Tooltip";
import { longDate } from "../format";
import { hm } from "../sleep";
import type { NightCell } from "../weekly";
import { minToClock } from "./bedtime";
import { cursorBand, grid, yAxis } from "./axes";

const LIGHT = { green: "All clear", yellow: "Worth watching", red: "Take it easy", unknown: "Still learning" };

/** The week night by night: hours asleep as bars, the sleep score above each one. */
export function WeekNightsChart({ cells }: { cells: NightCell[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={cells} margin={{ top: 22, right: 8, bottom: 0, left: -12 }} barCategoryGap="25%">
        {grid()}
        <XAxis dataKey="weekday" stroke="var(--axis)" tick={{ fill: "var(--muted)", fontSize: 12 }} tickLine={false} />
        {yAxis({ domain: [0, 10], ticks: [0, 2, 4, 6, 8, 10], unit: "h" })}
        <Tooltip
          cursor={cursorBand}
          content={({ active, payload }) => {
            const c = payload?.[0]?.payload as NightCell | undefined;
            if (!active || !c) return null;
            return (
              <Tip
                title={longDate(c.date)}
                rows={[
                  { label: "Time asleep", value: c.duration_h != null ? hm(c.duration_h * 3600) : "no data", color: "var(--c-sleep)" },
                  { label: "Sleep score", value: c.score ?? "–" },
                  { label: "Fell asleep", value: c.bedtime != null ? minToClock(c.bedtime) : "–" },
                  { label: "Recovery", value: c.recovery ? LIGHT[c.recovery] : "–" },
                ]}
              />
            );
          }}
        />
        <Bar dataKey="duration_h" fill="var(--c-sleep)" maxBarSize={40} radius={[4, 4, 0, 0]} isAnimationActive={false}>
          <LabelList dataKey="score" position="top" fill="var(--ink-2)" fontSize={12} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
