import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { NightRow } from "../api";
import { Tip } from "../components/Tooltip";
import { longDate, shortDate } from "../format";
import { cursorBand } from "./axes";
import { MAX_ROWS, mean, minToClock, sleepWindows } from "./bedtime";

const ROW_PX = 16;

/**
 * When you were asleep, one row per night: a bar from bedtime (left) to wake time
 * (right), like a timeline. Two hairlines mark your usual bedtime and wake time, so
 * late nights and early alarms stand out. Shows the latest 60 nights at most.
 */
export function BedtimeChart({ rows }: { rows: NightRow[] }) {
  const data = sleepWindows(rows).slice(-MAX_ROWS);
  if (!data.length) return <p className="muted">No nights in this range yet.</p>;
  const avgBed = mean(data.map((d) => d.bed));
  const avgWake = mean(data.map((d) => d.wake));
  const lo = Math.floor((Math.min(...data.map((d) => d.bed)) - 30) / 120) * 120;
  const hi = Math.ceil((Math.max(...data.map((d) => d.wake)) + 30) / 120) * 120;
  const ticks = Array.from({ length: (hi - lo) / 120 + 1 }, (_, i) => lo + i * 120);
  const height = Math.max(180, data.length * ROW_PX + 40);
  return (
    <>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 12, bottom: 0, left: 0 }} barCategoryGap="25%">
          <CartesianGrid stroke="var(--grid)" horizontal={false} />
          <XAxis
            type="number"
            domain={[lo, hi]}
            ticks={ticks}
            tickFormatter={minToClock}
            stroke="var(--axis)"
            tick={{ fill: "var(--muted)", fontSize: 12 }}
            tickLine={false}
            orientation="top"
          />
          <YAxis
            type="category"
            dataKey="date"
            tickFormatter={shortDate}
            stroke="var(--axis)"
            tick={{ fill: "var(--muted)", fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            width={56}
            interval={data.length > 21 ? Math.ceil(data.length / 14) - 1 : 0}
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
          <Bar dataKey="window" fill="var(--bar)" maxBarSize={12} radius={3} isAnimationActive={false} />
          {/* Drawn after the bars so the lines sit on top. */}
          <ReferenceLine x={avgBed} stroke="var(--ink)" strokeWidth={1} />
          <ReferenceLine x={avgWake} stroke="var(--ink)" strokeWidth={1} />
        </BarChart>
      </ResponsiveContainer>
      <div className="legend">
        <span>
          <span className="swatch" style={{ background: "var(--bar)" }} /> Asleep
        </span>
        <span>
          <span className="swatch line" style={{ background: "var(--ink)" }} /> Usual: {minToClock(avgBed)} to {minToClock(avgWake)}
        </span>
        {sleepWindows(rows).length > MAX_ROWS && <span className="muted">Latest {MAX_ROWS} nights</span>}
      </div>
    </>
  );
}
