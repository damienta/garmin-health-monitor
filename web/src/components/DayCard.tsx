import type { ReactNode } from "react";
import type { ActivityRow, DayRow } from "../api";
import { dayBaseline, intensity } from "../day";
import { longDate } from "../format";
import { hm } from "../sleep";
import { Card } from "./Card";
import { Delta } from "./Delta";

const n = (v: number) => Math.round(v).toLocaleString("en-GB");
const diff = (a: number | null, b: number | null) => (a == null || b == null ? null : a - b);

/**
 * The day that led into last night: movement, stress, energy and workouts, each against
 * the 7 days before. `exact` is false when that day hasn't synced and we show an older one.
 */
export function DayCard({
  day,
  exact,
  wanted,
  days,
  workouts,
  delay,
}: {
  day: DayRow;
  exact: boolean;
  wanted: string;
  days: DayRow[];
  workouts: ActivityRow[];
  delay?: number;
}) {
  const usual = dayBaseline(days, day.date);
  const mins = day.moderate_min == null && day.vigorous_min == null ? null : intensity(day);
  const goal = day.step_goal ?? null;
  return (
    <Card
      title={exact ? "Yesterday" : "Latest day"}
      delay={delay}
      aside={<span className="sub">{exact ? longDate(day.date) : `${longDate(wanted)} not synced yet, showing ${longDate(day.date)}`}</span>}
    >
      <div className="tiles">
        <Tile label="Steps" value={day.steps != null ? n(day.steps) : "–"}>
          {goal != null && day.steps != null && (
            <>
              <div className="meter" aria-hidden>
                <div style={{ width: `${Math.min(100, (day.steps / goal) * 100)}%` }} />
              </div>
              <div className="muted small">
                {day.steps >= goal ? "Goal hit" : `${n(goal - day.steps)} short`} of {n(goal)}
              </div>
            </>
          )}
          <Delta diff={diff(day.steps, usual.steps)} format={n} />
        </Tile>
        <Tile label="Body Battery" value={day.bb_low != null && day.bb_high != null ? `${day.bb_low} to ${day.bb_high}` : "–"}>
          {day.bb_charged != null && day.bb_drained != null && (
            <div className="muted small">
              +{day.bb_charged} charged, −{day.bb_drained} drained
            </div>
          )}
          <Delta diff={diff(day.bb_high, usual.bb_high)} format={n} />
        </Tile>
        <Tile label="Stress" value={day.stress_avg != null ? `${day.stress_avg}` : "–"}>
          {day.stress_max != null && <div className="muted small">average, peak {day.stress_max}</div>}
          <Delta diff={diff(day.stress_avg, usual.stress)} format={n} better="down" />
        </Tile>
        <Tile label="Intensity minutes" value={mins != null ? `${mins}` : "–"}>
          {mins != null && (
            <div className="muted small">
              {day.moderate_min ?? 0} moderate, {day.vigorous_min ?? 0} vigorous
            </div>
          )}
          <Delta diff={diff(mins, usual.intensity)} format={n} />
        </Tile>
        <Tile label="Active calories" value={day.active_kcal != null ? `${n(day.active_kcal)} kcal` : "–"}>
          <Delta diff={diff(day.active_kcal, usual.active_kcal)} format={(x) => `${n(x)} kcal`} />
        </Tile>
        <Tile label="Distance" value={day.distance_m != null ? `${(day.distance_m / 1000).toFixed(1)} km` : "–"} />
        <Tile label="Resting HR (day)" value={day.resting_hr != null ? `${day.resting_hr} bpm` : "–"}>
          <Delta diff={diff(day.resting_hr, usual.resting_hr)} format={(x) => `${n(x)} bpm`} better="down" />
        </Tile>
        <Tile label="Workouts" value={`${workouts.length}`}>
          <div className="muted small">
            {workouts.length ? hm(workouts.reduce((a, w) => a + (w.duration_s ?? 0), 0)) + " in total" : "rest day"}
          </div>
        </Tile>
      </div>
      {workouts.length > 0 && (
        <div className="day-workouts">
          <table className="table">
            <tbody>
              {workouts.map((w) => (
                <tr key={w.id}>
                  <td>{w.name ?? w.type ?? "Workout"}</td>
                  <td className="num">{hm(w.duration_s)}</td>
                  <td className="num">{w.distance_m ? `${(w.distance_m / 1000).toFixed(1)} km` : "–"}</td>
                  <td className="num">{w.avg_hr ? `${w.avg_hr} bpm` : "–"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function Tile({ label, value, children }: { label: string; value: string; children?: ReactNode }) {
  return (
    <div className="tile">
      <div className="stat-label">{label}</div>
      <div className="tile-value">{value}</div>
      {children}
    </div>
  );
}
