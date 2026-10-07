import type { Night } from "../api";
import { hm, stageSplit } from "../sleep";

/** One horizontal bar split into stages, 2px gaps between segments, legend with times. */
export function StageBar({ night }: { night: Night }) {
  const split = stageSplit(night).filter((s) => s.seconds > 0);
  return (
    <div>
      <div className="stagebar" role="img" aria-label={split.map((s) => `${s.label} ${hm(s.seconds)}`).join(", ")}>
        {split.map((s) => (
          <div
            key={s.key}
            title={`${s.label} ${hm(s.seconds)} (${Math.round(s.share * 100)}%)`}
            style={{ flexGrow: s.share, background: s.color }}
          />
        ))}
      </div>
      <div className="stagebar-legend">
        {split.map((s) => (
          <div key={s.key}>
            <span className="label">
              <span className="swatch" style={{ background: s.color }} />
              {s.label}
            </span>
            <span className="value">{hm(s.seconds)}</span>
            <span className="muted">{Math.round(s.share * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
