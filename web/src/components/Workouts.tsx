import type { ActivityRow } from "../api";
import { longDate } from "../format";
import { hm } from "../sleep";

/** "running" -> "Running", "strength_training" -> "Strength training". */
export const typeLabel = (t: string | null) => (t ? (t[0].toUpperCase() + t.slice(1)).replace(/_/g, " ") : "Workout");

const km = (m: number | null) => (m ? `${(m / 1000).toFixed(1)} km` : "–");

/** Workouts in the range, newest first. A table: people look values up, they don't compare shapes. */
export function Workouts({ rows }: { rows: ActivityRow[] }) {
  if (!rows.length) return <p className="muted">No workouts in this range.</p>;
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Workout</th>
            <th className="num">Time</th>
            <th className="num">Distance</th>
            <th className="num">Avg HR</th>
            <th className="num">Load</th>
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 12).map((a) => (
            <tr key={a.id}>
              <td className="muted nowrap">{longDate(a.date)}</td>
              <td>
                <div>{typeLabel(a.type)}</div>
                {a.name && a.name !== typeLabel(a.type) && <div className="muted small">{a.name}</div>}
              </td>
              <td className="num">{hm(a.duration_s)}</td>
              <td className="num">{km(a.distance_m)}</td>
              <td className="num">{a.avg_hr ? `${a.avg_hr} bpm` : "–"}</td>
              <td className="num">{a.training_load != null ? Math.round(a.training_load) : "–"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
