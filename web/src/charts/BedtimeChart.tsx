import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { NightRow } from "../api";
import { Tip } from "../components/Tooltip";
import { shortDate } from "../format";
import { usePeriod } from "./period";
import { toWeeks } from "../series";
import { cursorBand } from "./axes";
import { MAX_ROWS, mean, minToClock, sleepWindows } from "./bedtime";

const ROW_PX = 16;

/**
 * When you were asleep, one row per night: a bar from bedtime (left) to wake time
 * (right), like a timeline. Two hairlines mark your usual bedtime and wake time, so
 * late nights and early alarms stand out. Shows the latest 60 nights at most; in weekly
 * mode each row is a week's average bed and wake time.
 */
export function BedtimeChart({ rows }: { rows: NightRow[] }) {
  const period = usePeriod();
  const known = sleepWindows(rows);
  if (!known.length) return <p className="muted">No nights in this range yet.</p>;
  // Every date in the range gets a row (empty when there's no night), so this chart
  // spans the same dates as the others.
  const byDate = new Map(known.map((w) => [w.date, w]));
  const all = rows.map((r) => byDate.get(r.date) ?? { date: r.date, bed: null, wake: null });
  const rowsShown = period.weekly ? toWeeks(all) : all.slice(-MAX_ROWS);
  const data = rowsShown.map((w) => ({
    ...w,
    window: w.bed != null && w.wake != null ? ([w.bed, w.wake] as [number, number]) : null,
  }));
  const withData = data.filter((d): d is typeof d & { bed: number; wake: number } => d.bed != null && d.wake != null);
  const avgBed = mean(withData.map((d) => d.bed));
  const avgWake = mean(withData.map((d) => d.wake));
  const lo = Math.floor((Math.min(...withData.map((d) => d.bed)) - 30) / 120) * 120;
  const hi = Math.ceil((Math.max(...withData.map((d) => d.wake)) + 30) / 120) * 120;
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
            tickFormatter={(d: string) => shortDate(d)}
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
              if (!active || !r || r.bed == null || r.wake == null) return null;
              return (
                <Tip
                  title={period.title(r.date)}
                  rows={[
                    { label: period.weekly ? "Average bedtime" : "Fell asleep", value: minToClock(r.bed) },
                    { label: period.weekly ? "Average wake" : "Woke up", value: minToClock(r.wake) },
                  ]}
                />
              );
            }}
          />
          <Bar dataKey="window" fill="var(--c-window)" maxBarSize={12} radius={3} isAnimationActive={false} />
          {/* Drawn after the bars so the lines sit on top. */}
          <ReferenceLine x={avgBed} stroke="var(--ink)" strokeWidth={1} />
          <ReferenceLine x={avgWake} stroke="var(--ink)" strokeWidth={1} />
        </BarChart>
      </ResponsiveContainer>
      <div className="legend">
        <span>
          <span className="swatch" style={{ background: "var(--c-window)" }} /> Asleep
        </span>
        <span>
          <span className="swatch line" style={{ background: "var(--ink)" }} /> Usual: {minToClock(avgBed)} to {minToClock(avgWake)}
        </span>
        {!period.weekly && rows.length > MAX_ROWS && <span className="muted">Latest {MAX_ROWS} nights</span>}
      </div>
    </>
  );
}
