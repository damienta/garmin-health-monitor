import type { Recovery } from "../recovery";
import { Card } from "./Card";

const TITLES = { green: "All clear", yellow: "Worth watching", red: "Take it easy", unknown: "Still learning" };

/** The early-warning traffic light: HRV and resting HR against your own 30-night normal. */
export function RecoveryCheck({ r, delay }: { r: Recovery; delay?: number }) {
  const vs = (v: number | null, normal: number | null, unit: string) =>
    v == null ? "–" : `${Math.round(v)} ${unit}${normal != null ? ` (normal ${Math.round(normal)})` : ""}`;
  return (
    <Card title="Recovery check" delay={delay} aside={<span className="sub">vs your last 30 nights</span>}>
      <div className="status" role="status">
        <span className={`status-dot ${r.level}`} aria-hidden />
        <div>
          <div className="status-title">{TITLES[r.level]}</div>
          <p className="prose">{r.message}</p>
          <p className="muted small">
            HRV {vs(r.hrv, r.hrvNormal, "ms")} · Resting HR {vs(r.rhr, r.rhrNormal, "bpm")}
          </p>
        </div>
      </div>
    </Card>
  );
}
