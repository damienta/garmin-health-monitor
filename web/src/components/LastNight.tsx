import type { ReactNode } from "react";
import { getNight, getTrends, type Night, type TrendRow } from "../api";
import { Hypnogram } from "../charts/Hypnogram";
import { StageBar } from "../charts/StageBar";
import { longDate } from "../format";
import { baseline, clock, hm } from "../sleep";
import { useLoad } from "../useApi";
import { Card } from "./Card";
import { CountUp } from "./CountUp";
import { Delta } from "./Delta";

/** Last night in full: score, times, vitals against your usual, stage split and timeline. */
export function LastNight({ date }: { date: string }) {
  const data = useLoad(
    () => Promise.all([getNight(date), getTrends(14)]),
    `night-${date}`,
  );

  if (data.kind === "loading") {
    return (
      <Card title="Last night">
        <div className="skeleton" style={{ height: 180 }} />
      </Card>
    );
  }
  if (data.kind === "error") {
    return (
      <Card title="Last night">
        <p className="error">Couldn't load last night: {data.message}</p>
      </Card>
    );
  }
  const [night, rows] = data.data;
  return (
    <>
      <Summary night={night} rows={rows} />
      <Card title="Sleep stages" aside={<span className="sub">{longDate(night.date)}</span>} delay={120}>
        <Hypnogram night={night} />
      </Card>
    </>
  );
}

function Summary({ night, rows }: { night: Night; rows: TrendRow[] }) {
  const usual = baseline(rows, night.date);
  const diff = (a: number | null, b: number | null) => (a == null || b == null ? null : a - b);
  return (
    <Card title="Last night" aside={<span className="sub">{longDate(night.date)}</span>} delay={60}>
      <div className="lastnight">
        <div className="hero">
          <div className="hero-number">{night.score != null ? <CountUp value={night.score} /> : "–"}</div>
          <div className="hero-label">Sleep score</div>
          <Delta diff={diff(night.score, usual.score)} format={(x) => `${Math.round(x)}`} />
          <div className="hero-times">
            {clock(night.start_ts, night.tz_offset_min)} → {clock(night.end_ts, night.tz_offset_min)}
          </div>
        </div>
        <div className="stats">
          <Stat label="Time asleep" value={hm(night.duration_s)}>
            <Delta
              diff={diff(night.duration_s / 3600, usual.duration_h)}
              format={(h) => hm(h * 3600)}
            />
          </Stat>
          <Stat label="HRV" value={night.hrv_avg != null ? `${Math.round(night.hrv_avg)} ms` : "–"}>
            <Delta diff={diff(night.hrv_avg, usual.hrv)} format={(x) => `${Math.round(x)} ms`} />
          </Stat>
          <Stat label="Resting HR" value={night.resting_hr != null ? `${night.resting_hr} bpm` : "–"}>
            <Delta diff={diff(night.resting_hr, usual.resting_hr)} format={(x) => `${Math.round(x)} bpm`} better="down" />
          </Stat>
          <div className="stat-wide">
            <StageBar night={night} />
          </div>
        </div>
      </div>
    </Card>
  );
}

function Stat({ label, value, children }: { label: string; value: string; children: ReactNode }) {
  return (
    <div className="stat">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {children}
    </div>
  );
}
