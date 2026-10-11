import { Bar, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip } from "recharts";
import type { TrendRow } from "../api";
import { Tip } from "../components/Tooltip";
import { usePeriod } from "./period";
import { weekStart } from "../series";
import { type DebtRow, sleepDebt } from "../insights";
import { hm } from "../sleep";
import { cursorBand, grid, xAxis, yAxis } from "./axes";

const signed = (h: number | null) => (h == null ? "–" : `${h < 0 ? "−" : "+"}${hm(Math.abs(h) * 3600)}`);

/**
 * Each night against your usual (bars above or below zero), and the running total over
 * the last 7 nights (the line). The line dipping well below zero is sleep debt building.
 */
export function SleepDebtChart({ rows }: { rows: TrendRow[] }) {
  const period = usePeriod();
  const { usual_h, rows: daily } = sleepDebt(rows);
  if (usual_h == null) return <p className="muted">No nights in this range yet.</p>;
  // Weekly: each bar is the week's total vs your usual; the 7-night line is dropped.
  const data = period.weekly ? weeklyTotals(daily) : daily;
  const values = data.flatMap((d) => [d.diff_h, d.debt_7d]).filter((v): v is number => v != null);
  // Whole hours either side of zero, ticks every hour (every 2 when the range is wide).
  const lo = Math.floor(Math.min(0, ...values));
  const hi = Math.ceil(Math.max(0, ...values));
  const step = hi - lo > 8 ? 2 : 1;
  const ticks: number[] = [];
  for (let t = Math.floor(lo / step) * step; t <= hi; t += step) ticks.push(t);
  return (
    <>
      <ResponsiveContainer width="100%" height={220}>
        <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }} barCategoryGap="20%">
          {grid()}
          {xAxis()}
          {yAxis({ domain: [ticks[0], ticks.at(-1)!], ticks, unit: "h" })}
          <Tooltip
            cursor={cursorBand}
            content={({ active, payload }) => {
              const r = payload?.[0]?.payload as (typeof data)[number] | undefined;
              if (!active || !r) return null;
              return (
                <Tip
                  title={period.title(r.date)}
                  rows={[
                    { label: period.weekly ? "Week vs usual" : "vs usual", value: signed(r.diff_h), color: "var(--c-sleep)" },
                    ...(period.weekly
                      ? []
                      : [{ label: "Last 7 nights", value: signed(r.debt_7d), color: "var(--ink)", shape: "line" as const }]),
                  ]}
                />
              );
            }}
          />
          <ReferenceLine y={0} stroke="var(--axis)" />
          <Bar dataKey="diff_h" fill="var(--c-sleep)" maxBarSize={24} radius={2} isAnimationActive={false} />
          <Line dataKey="debt_7d" stroke="var(--ink)" strokeWidth={2} dot={false} activeDot={false} isAnimationActive={false} connectNulls />
        </ComposedChart>
      </ResponsiveContainer>
      <div className="legend">
        <span>
          <span className="swatch" style={{ background: "var(--c-sleep)" }} /> {period.weekly ? "Week" : "Night"} vs your usual{" "}
          {hm(usual_h * 3600)} a night
        </span>
        {!period.weekly && (
          <span>
            <span className="swatch line" style={{ background: "var(--ink)" }} /> Running total, last 7 nights
          </span>
        )}
      </div>
    </>
  );
}

function weeklyTotals(rows: DebtRow[]): DebtRow[] {
  const weeks = new Map<string, number[]>();
  for (const r of rows) {
    const w = weekStart(r.date);
    if (!weeks.has(w)) weeks.set(w, []);
    if (r.diff_h != null) weeks.get(w)!.push(r.diff_h);
  }
  return [...weeks].map(([date, xs]) => ({ date, diff_h: xs.length ? xs.reduce((a, b) => a + b, 0) : null, debt_7d: null }));
}

/** "Last 7 nights: 1h 20m short of your usual" for the card's corner. */
export function debtText(rows: TrendRow[]) {
  const last = sleepDebt(rows).rows.at(-1)?.debt_7d;
  if (last == null) return "";
  if (Math.abs(last) < 0.25) return "Last 7 nights: about even";
  return `Last 7 nights: ${hm(Math.abs(last) * 3600)} ${last < 0 ? "short" : "extra"}`;
}
