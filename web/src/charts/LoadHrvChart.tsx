import { ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis } from "recharts";
import type { ActivityRow, TrendRow } from "../api";
import { Tip } from "../components/Tooltip";
import { longDate } from "../format";
import { loadVsHrv } from "../insights";
import { cursorLine, grid, yAxis } from "./axes";
import { niceRange } from "./scale";

/**
 * Does a hard day show up in that night's HRV? One dot per night: across is the training
 * load of the day before (0 = rest day), up is HRV. Dots drifting down to the right mean
 * hard days cost you recovery.
 */
export function LoadHrvChart({ nights, activities }: { nights: TrendRow[]; activities: ActivityRow[] }) {
  const r = loadVsHrv(nights, activities);
  if (!r.points.length) return <p className="muted">No HRV in this range yet.</p>;
  const y = niceRange(r.points.map((p) => p.hrv));
  return (
    <>
      <ResponsiveContainer width="100%" height={220}>
        <ScatterChart margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
          {grid()}
          <XAxis
            type="number"
            dataKey="load"
            name="Training load"
            stroke="var(--axis)"
            tick={{ fill: "var(--muted)", fontSize: 12 }}
            tickLine={false}
            allowDecimals={false}
          />
          {yAxis({ ...y, unit: "" })}
          <Tooltip
            cursor={cursorLine}
            content={({ active, payload }) => {
              const p = payload?.[0]?.payload as (typeof r.points)[number] | undefined;
              if (!active || !p) return null;
              return (
                <Tip
                  title={`Night of ${longDate(p.date)}`}
                  rows={[
                    { label: "Load the day before", value: p.load ? Math.round(p.load) : "rest day" },
                    { label: "HRV", value: `${Math.round(p.hrv)} ms`, color: "var(--ink)", shape: "dot" },
                  ]}
                />
              );
            }}
          />
          <Scatter data={r.points} dataKey="hrv" fill="var(--ink)" fillOpacity={0.55} isAnimationActive={false} />
        </ScatterChart>
      </ResponsiveContainer>
      <p className="muted small">
        {r.afterHard != null && r.afterRest != null
          ? `HRV averages ${Math.round(r.afterHard)} ms after hard days (load ${Math.round(r.hardCut!)}+) and ${Math.round(r.afterRest)} ms after rest days.`
          : "Training load (across) of the day before vs that night's HRV (up, ms). Needs a few more workouts and rest days to compare."}
      </p>
    </>
  );
}
