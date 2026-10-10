import type { ReactNode } from "react";
import { type ActivityRow, type DayRow, getActivities, getDays, getNight, getTrends, type Night, type TrendRow } from "../api";
import { Hypnogram } from "../charts/Hypnogram";
import { StageBar } from "../charts/StageBar";
import { longDate } from "../format";
import { baseline, clock, hm } from "../sleep";
import { pickDay, previousDate } from "../day";
import { checkRecovery } from "../recovery";
import { headline, writeSummary } from "../summary";
import { writeTips } from "../tips";
import { DayCard } from "./DayCard";
import { RecoveryCheck } from "./RecoveryCheck";
import { useLoad } from "../useApi";
import { Card } from "./Card";
import { CountUp } from "./CountUp";
import { Delta } from "./Delta";

/**
 * The Yesterday page: last night's sleep, a recovery check, a written summary with tips,
 * the day that led into the night, and the stage timeline.
 */
export function LastNight({ date }: { date: string }) {
  const data = useLoad(
    // Days and workouts can fail (older data has none) without hiding the night.
    () =>
      Promise.all([
        getNight(date),
        getTrends(45),
        getDays(14).catch(() => [] as DayRow[]),
        getActivities(14).catch(() => [] as ActivityRow[]),
      ]),
    `night-${date}`,
  );
  const nightTitle = `Night of ${longDate(previousDate(date))}`;

  if (data.kind === "loading") {
    return (
      <Card title={nightTitle}>
        <div className="skeleton" style={{ height: 180 }} />
      </Card>
    );
  }
  if (data.kind === "error") {
    return (
      <Card title={nightTitle}>
        <p className="error">Couldn't load last night: {data.message}</p>
      </Card>
    );
  }
  const [night, rows, days, activities] = data.data;
  const usual = baseline(rows, night.date);
  const recovery = checkRecovery(rows, night.date);
  const picked = pickDay(days, previousDate(night.date));
  const day = picked?.exact ? picked.day : null;
  const workouts = picked ? activities.filter((a) => a.date === picked.day.date) : [];
  const sentences = writeSummary(night, usual, day, workouts);
  const tips = writeTips(night, usual, day, recovery);
  return (
    <>
      <Summary night={night} rows={rows} title={nightTitle} />
      <RecoveryCheck r={recovery} delay={90} />
      <div className="grid-2">
        <Card title="In short" delay={120}>
          <p className="headline">{headline(night, usual, recovery)}</p>
          <p className="prose">{sentences.join(" ")}</p>
        </Card>
        <Card title="Try this" delay={150} aside={<span className="sub">General tips, not medical advice</span>}>
          <ul className="tips">
            {tips.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </Card>
      </div>
      {picked ? (
        <DayCard
          day={picked.day}
          exact={picked.exact}
          wanted={previousDate(night.date)}
          days={days}
          workouts={workouts}
          delay={180}
        />
      ) : (
        <Card title="Yesterday" delay={180}>
          <p className="muted">No daily numbers yet. Steps, stress and Body Battery appear after the next daily run.</p>
        </Card>
      )}
      <Card title="Sleep stages" aside={<span className="sub">{longDate(night.date)}</span>} delay={210}>
        <Hypnogram night={night} />
      </Card>
    </>
  );
}

function Summary({ night, rows, title }: { night: Night; rows: TrendRow[]; title: string }) {
  const usual = baseline(rows, night.date);
  const diff = (a: number | null, b: number | null) => (a == null || b == null ? null : a - b);
  return (
    <Card title={title} aside={<span className="sub">woke {longDate(night.date)}</span>} delay={60}>
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
