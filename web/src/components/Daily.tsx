import type { ReactNode } from "react";
import { type DayRow, getDays, getNight, getTrends, type Night, type TrendRow } from "../api";
import { Hypnogram } from "../charts/Hypnogram";
import { StageBar } from "../charts/StageBar";
import { dayBaseline, nextDate, pickDay } from "../day";
import { longDate } from "../format";
import { checkRecovery, type Recovery } from "../recovery";
import { baseline, clock, hm } from "../sleep";
import { headline, writeSummary } from "../summary";
import { useLoad } from "../useApi";
import { Card } from "./Card";
import { CountUp } from "./CountUp";
import { Delta } from "./Delta";

const n = (v: number) => Math.round(v).toLocaleString("en-GB");
const diff = (a: number | null | undefined, b: number | null | undefined) => (a == null || b == null ? null : a - b);

/**
 * One day, one date: that day's stats and the sleep that followed it (the night you woke
 * up from the next morning). Both halves are complete by the time the daily run lands.
 */
export function Daily({ day }: { day: string }) {
  const wake = nextDate(day);
  const data = useLoad(
    () =>
      Promise.all([
        // A missing night (watch not worn) is a 404: show the day anyway.
        getNight(wake).catch(() => null as Night | null),
        getTrends(60),
        getDays(21).catch(() => [] as DayRow[]),
      ]),
    `daily-${day}`,
  );

  if (data.kind === "loading") return <div className="skeleton" style={{ height: 320 }} />;
  if (data.kind === "error") return <p className="error">Couldn't load this day: {data.message}</p>;

  const [night, rows, days] = data.data;
  const picked = pickDay(days, day);
  const dayRow = picked?.exact ? picked.day : null;
  return (
    <>
      {night ? (
        <SleepCard night={night} rows={rows} />
      ) : (
        <Card title="Sleep">
          <p className="muted">No sleep recorded for this night. The watch may not have been worn, or hasn't synced yet.</p>
        </Card>
      )}
      {night && <InShort night={night} rows={rows} day={dayRow} recovery={checkRecovery(rows, night.date)} />}
      <DayStats day={dayRow} days={days} />
      {night && (
        <Card title="Sleep stages" delay={240}>
          <Hypnogram night={night} />
        </Card>
      )}
    </>
  );
}

function SleepCard({ night, rows }: { night: Night; rows: TrendRow[] }) {
  const usual = baseline(rows, night.date);
  return (
    <Card title="Sleep" delay={60}>
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
            <Delta diff={diff(night.duration_s / 3600, usual.duration_h)} format={(h) => hm(h * 3600)} />
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
          <Stat
            label="Overnight recharge"
            value={night.body_battery_change != null ? `${night.body_battery_change > 0 ? "+" : ""}${night.body_battery_change}` : "–"}
          >
            <span className="muted small">Body Battery gained</span>
          </Stat>
          <Stat label="Breathing" value={night.respiration_avg != null ? `${night.respiration_avg.toFixed(1)}` : "–"}>
            <span className="muted small">breaths a minute</span>
          </Stat>
          <Stat label="Sleep stress" value={night.stress_avg != null ? `${Math.round(night.stress_avg)}` : "–"}>
            <span className="muted small">
              {night.awake_count != null ? `woke ${night.awake_count} time${night.awake_count === 1 ? "" : "s"}` : "lower is calmer"}
            </span>
          </Stat>
        </div>
      </div>
    </Card>
  );
}

const LIGHT = { green: "All clear", yellow: "Worth watching", red: "Take it easy", unknown: "Still learning your normal" };

/** The recovery light first, then a one-line verdict and the plain-English summary. */
function InShort({ night, rows, day, recovery: r }: { night: Night; rows: TrendRow[]; day: DayRow | null; recovery: Recovery }) {
  const usual = baseline(rows, night.date);
  const vs = (v: number | null, normal: number | null, unit: string) =>
    v == null ? "–" : `${Math.round(v)} ${unit}${normal != null ? ` (normal ${Math.round(normal)})` : ""}`;
  return (
    <Card title="In short" delay={120}>
      <div className="status" role="status">
        <span className={`status-dot ${r.level}`} aria-hidden />
        <div>
          <div className="status-title">Recovery: {LIGHT[r.level]}</div>
          <p className="muted small">
            {r.message} HRV {vs(r.hrv, r.hrvNormal, "ms")} · Resting HR {vs(r.rhr, r.rhrNormal, "bpm")}, vs your last 30 nights.
          </p>
        </div>
      </div>
      <p className="headline">{headline(night, usual)}</p>
      <p className="prose">{writeSummary(night, usual, day).join(" ")}</p>
    </Card>
  );
}

/** The day's own numbers, each against the 7 days before. */
function DayStats({ day, days }: { day: DayRow | null; days: DayRow[] }) {
  if (!day) {
    return (
      <Card title="Day stats" delay={180}>
        <p className="muted">No step, stress or Body Battery data for this day yet.</p>
      </Card>
    );
  }
  const usual = dayBaseline(days, day.date);
  const goal = day.step_goal ?? null;
  return (
    <Card title="Day stats" delay={180}>
      <div className="tiles three">
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
        <Tile label="Active calories" value={day.active_kcal != null ? `${n(day.active_kcal)} kcal` : "–"}>
          <Delta diff={diff(day.active_kcal, usual.active_kcal)} format={(x) => `${n(x)} kcal`} />
        </Tile>
        <Tile label="Distance" value={day.distance_m != null ? `${(day.distance_m / 1000).toFixed(1)} km` : "–"} />
        <Tile label="Resting HR (day)" value={day.resting_hr != null ? `${day.resting_hr} bpm` : "–"}>
          <Delta diff={diff(day.resting_hr, usual.resting_hr)} format={(x) => `${n(x)} bpm`} better="down" />
        </Tile>
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

function Tile({ label, value, children }: { label: string; value: string; children?: ReactNode }) {
  return (
    <div className="tile">
      <div className="stat-label">{label}</div>
      <div className="tile-value">{value}</div>
      {children}
    </div>
  );
}
