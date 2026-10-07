import { Bar, BarChart, ResponsiveContainer, Tooltip } from "recharts";
import type { NightRow } from "../api";
import { Tip } from "../components/Tooltip";
import { longDate } from "../format";
import { hm, STAGES } from "../sleep";
import { cursorBand, grid, xAxis, yAxis } from "./axes";

/** Each night as a stacked column of stage hours. A 2px surface gap separates segments. */
export function StageMixChart({ rows }: { rows: NightRow[] }) {
  const data = rows.map((r) => ({
    date: r.date,
    deep: (r.deep_s ?? 0) / 3600,
    light: (r.light_s ?? 0) / 3600,
    rem: (r.rem_s ?? 0) / 3600,
    awake: (r.awake_s ?? 0) / 3600,
  }));
  return (
    <>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }} barCategoryGap="20%">
          {grid()}
          {xAxis()}
          {yAxis({ domain: [0, 10], ticks: [0, 2, 4, 6, 8, 10], unit: "h" })}
          <Tooltip
            cursor={cursorBand}
            content={({ active, payload }) => {
              const r = payload?.[0]?.payload as (typeof data)[number] | undefined;
              if (!active || !r) return null;
              return (
                <Tip
                  title={longDate(r.date)}
                  rows={[...STAGES].reverse().map((s) => ({ label: s.label, value: hm(r[s.key] * 3600), color: s.color }))}
                />
              );
            }}
          />
          {STAGES.map((s, i) => (
            <Bar
              key={s.key}
              dataKey={s.key}
              stackId="night"
              fill={s.color}
              stroke="var(--surface)"
              strokeWidth={1}
              maxBarSize={24}
              radius={i === STAGES.length - 1 ? [4, 4, 0, 0] : 0}
              isAnimationActive={false}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
      <div className="legend">
        {STAGES.map((s) => (
          <span key={s.key}>
            <span className="swatch" style={{ background: s.color }} /> {s.label}
          </span>
        ))}
      </div>
    </>
  );
}
