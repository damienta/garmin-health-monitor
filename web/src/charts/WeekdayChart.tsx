import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import type { TrendRow } from "../api";
import { Tip } from "../components/Tooltip";
import { byWeekday } from "../insights";
import { hm } from "../sleep";
import { cursorBand, grid, yAxis } from "./axes";
import { niceRange } from "./scale";

/**
 * Your average sleep score for each night of the week, named by the evening you went
 * to bed. The best and worst nights are called out underneath.
 */
export function WeekdayChart({ rows }: { rows: TrendRow[] }) {
  const data = byWeekday(rows);
  const scored = data.filter((d) => d.score != null);
  if (scored.length < 2) return <p className="muted">Needs a couple of weeks of nights first.</p>;
  const best = scored.reduce((a, b) => (b.score! > a.score! ? b : a));
  const worst = scored.reduce((a, b) => (b.score! < a.score! ? b : a));
  const y = niceRange(scored.map((d) => d.score));
  return (
    <>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }} barCategoryGap="25%">
          {grid()}
          <XAxis dataKey="short" stroke="var(--axis)" tick={{ fill: "var(--muted)", fontSize: 12 }} tickLine={false} />
          {yAxis(y)}
          <Tooltip
            cursor={cursorBand}
            content={({ active, payload }) => {
              const r = payload?.[0]?.payload as (typeof data)[number] | undefined;
              if (!active || !r) return null;
              return (
                <Tip
                  title={`${r.day} nights`}
                  rows={[
                    { label: "Average score", value: r.score != null ? Math.round(r.score) : "–", color: "var(--c-score)" },
                    { label: "Average sleep", value: r.duration_h != null ? hm(r.duration_h * 3600) : "–" },
                    { label: "Nights", value: r.nights },
                  ]}
                />
              );
            }}
          />
          <Bar dataKey="score" fill="var(--c-score)" maxBarSize={40} radius={[4, 4, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
      <p className="muted small">
        Best: {best.day} nights ({Math.round(best.score!)}). Worst: {worst.day} nights ({Math.round(worst.score!)}).
      </p>
    </>
  );
}
