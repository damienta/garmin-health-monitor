import { useState } from "react";
import type { Night, Stage } from "../api";
import { Tip } from "../components/Tooltip";
import { useWidth } from "../useWidth";
import { clock, hm, STAGES } from "../sleep";

const ROWS = ["awake", "rem", "light", "deep"] as const; // top to bottom, like the Garmin app
const ROW_H = 26;
const GAP = 6;
const LEFT = 52;
const AXIS_H = 22;

/**
 * Last night as a hypnogram: one row per stage, so the stage is readable from position
 * as well as colour. Hover a block for its stage and time.
 */
export function Hypnogram({ night }: { night: Night }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<{ s: Stage; x: number; y: number } | null>(null);
  const stages = night.stages.filter((s): s is Stage & { stage: (typeof ROWS)[number] } =>
    (ROWS as readonly string[]).includes(s.stage),
  );
  if (!stages.length) return <p className="muted">No stage data for this night.</p>;

  const t0 = night.start_ts;
  const t1 = night.end_ts;
  const plotW = Math.max(0, width - LEFT);
  const x = (t: number) => LEFT + ((t - t0) / (t1 - t0)) * plotW;
  const height = ROWS.length * (ROW_H + GAP) + AXIS_H;

  // An hour tick on each local hour boundary.
  const ticks: number[] = [];
  const offset = night.tz_offset_min * 60;
  for (let t = Math.ceil((t0 + offset) / 3600) * 3600 - offset; t <= t1; t += 3600) ticks.push(t);
  const every = plotW / Math.max(ticks.length, 1) < 44 ? 2 : 1;

  const color = (key: string) => STAGES.find((s) => s.key === key)!.color;
  const label = (key: string) => STAGES.find((s) => s.key === key)!.label;

  return (
    <div ref={ref} className="hypno" onMouseLeave={() => setHover(null)}>
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label="Sleep stages through the night">
          {ROWS.map((row, i) => (
            <g key={row}>
              <text x={0} y={i * (ROW_H + GAP) + ROW_H / 2} dy="0.35em" className="axis-label">
                {label(row)}
              </text>
              <line
                x1={LEFT}
                x2={width}
                y1={i * (ROW_H + GAP) + ROW_H / 2}
                y2={i * (ROW_H + GAP) + ROW_H / 2}
                stroke="var(--grid)"
              />
            </g>
          ))}
          {stages.map((s) => {
            const row = ROWS.indexOf(s.stage);
            const x0 = x(s.start_ts);
            const w = Math.max(1, x(s.end_ts) - x0 - 1); // 1px surface gap between neighbours
            return (
              <rect
                key={s.start_ts}
                x={x0}
                y={row * (ROW_H + GAP)}
                width={w}
                height={ROW_H}
                rx={Math.min(4, w / 2)}
                fill={color(s.stage)}
                opacity={hover && hover.s !== s ? 0.45 : 1}
                onMouseEnter={() => setHover({ s, x: x0 + w / 2, y: row * (ROW_H + GAP) })}
              />
            );
          })}
          {ticks.map((t, i) =>
            i % every ? null : (
              <text key={t} x={x(t)} y={height - 4} textAnchor="middle" className="axis-label">
                {clock(t, night.tz_offset_min)}
              </text>
            ),
          )}
        </svg>
      )}
      {hover && (
        <div className="hypno-tip" style={{ left: Math.max(0, Math.min(hover.x - 80, width - 170)), top: hover.y + ROW_H + 6 }}>
          <Tip
            title={`${clock(hover.s.start_ts, night.tz_offset_min)} – ${clock(hover.s.end_ts, night.tz_offset_min)}`}
            rows={[{ label: label(hover.s.stage), value: hm(hover.s.end_ts - hover.s.start_ts), color: color(hover.s.stage) }]}
          />
        </div>
      )}
      <div className="legend">
        {STAGES.map((s) => (
          <span key={s.key}>
            <span className="swatch" style={{ background: s.color }} /> {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}
