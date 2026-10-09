import { Bar, BarChart, ResponsiveContainer, Tooltip } from "recharts";
import type { DayRow } from "../api";
import { Tip } from "../components/Tooltip";
import { longDate } from "../format";
import { cursorBand, grid, xAxis, yAxis } from "./axes";

/** Moderate and vigorous minutes per day, stacked (they add up to your intensity minutes). */
export function IntensityChart({ rows }: { rows: DayRow[] }) {
  return (
    <>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: -12 }} barCategoryGap="20%">
          {grid()}
          {xAxis()}
          {yAxis()}
          <Tooltip
            cursor={cursorBand}
            content={({ active, payload }) => {
              const r = payload?.[0]?.payload as DayRow | undefined;
              if (!active || !r) return null;
              return (
                <Tip
                  title={longDate(r.date)}
                  rows={[
                    { label: "Vigorous", value: `${r.vigorous_min ?? 0} min`, color: "var(--ink)" },
                    { label: "Moderate", value: `${r.moderate_min ?? 0} min`, color: "var(--bar)" },
                  ]}
                />
              );
            }}
          />
          <Bar dataKey="moderate_min" stackId="d" fill="var(--bar)" stroke="var(--surface)" strokeWidth={1} maxBarSize={24} isAnimationActive={false} />
          <Bar dataKey="vigorous_min" stackId="d" fill="var(--ink)" stroke="var(--surface)" strokeWidth={1} maxBarSize={24} radius={[4, 4, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
      <div className="legend">
        <span>
          <span className="swatch" style={{ background: "var(--bar)" }} /> Moderate
        </span>
        <span>
          <span className="swatch" style={{ background: "var(--ink)" }} /> Vigorous
        </span>
      </div>
    </>
  );
}
