import { Bar, BarChart, ReferenceLine, ResponsiveContainer, Tooltip, YAxis } from "recharts";
import type { NightRow } from "../api";
import { Tip } from "../components/Tooltip";
import { longDate } from "../format";
import { cursorBand, grid, xAxis } from "./axes";
import { mean, minToClock, sleepWindows } from "./bedtime";

/**
 * When you were asleep, night by night: a bar from bedtime down to wake time, evening at
 * the top. Two hairlines mark your average bedtime and wake time, so drift stands out.
 */
export function BedtimeChart({ rows }: { rows: NightRow[] }) {
  const data = sleepWindows(rows);
  if (!data.length) return <p className="muted">No nights in this range yet.</p>;
  const avgBed = mean(data.map((d) => d.bed));
  const avgWake = mean(data.map((d) => d.wake));
  const lo = Math.floor((Math.min(...data.map((d) => d.bed)) - 30) / 120) * 120;
  const hi = Math.ceil((Math.max(...data.map((d) => d.wake)) + 30) / 120) * 120;
  const ticks = Array.from({ length: (hi - lo) / 120 + 1 }, (_, i) => lo + i * 120);
  return (
    <>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barCategoryGap="20%">
          {grid()}
          {xAxis()}
          <YAxis
            reversed
            domain={[lo, hi]}
            ticks={ticks}
            tickFormatter={minToClock}
            stroke="var(--axis)"
            tick={{ fill: "var(--muted)", fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            width={48}
          />
          <Tooltip
            cursor={cursorBand}
            content={({ active, payload }) => {
              const r = payload?.[0]?.payload as (typeof data)[number] | undefined;
              if (!active || !r) return null;
              return (
                <Tip
                  title={longDate(r.date)}
                  rows={[
                    { label: "Fell asleep", value: minToClock(r.bed) },
                    { label: "Woke up", value: minToClock(r.wake) },
                  ]}
                />
              );
            }}
          />
          <Bar dataKey="window" fill="var(--bar)" maxBarSize={24} radius={4} isAnimationActive={false} />
          {/* Drawn after the bars so the lines sit on top. */}
          <ReferenceLine y={avgBed} stroke="var(--ink)" strokeWidth={1} />
          <ReferenceLine y={avgWake} stroke="var(--ink)" strokeWidth={1} />
        </BarChart>
      </ResponsiveContainer>
      <div className="legend">
        <span>
          <span className="swatch" style={{ background: "var(--bar)" }} /> Asleep
        </span>
        <span>
          <span className="swatch line" style={{ background: "var(--ink)" }} /> Usual: {minToClock(avgBed)} to {minToClock(avgWake)}
        </span>
      </div>
    </>
  );
}
