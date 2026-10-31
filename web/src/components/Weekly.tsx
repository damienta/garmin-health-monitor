import type { ReactNode } from "react";
import { type DayRow, getDays, getTrends } from "../api";
import { minToClock } from "../charts/bedtime";
import { WeekNightsChart } from "../charts/WeekNightsChart";
import { shortDate } from "../format";
import { hm } from "../sleep";
import { useLoad } from "../useApi";
import { signedHm, type WeekStats, weeklyReport } from "../weekly";
import { Card } from "./Card";
import { Delta } from "./Delta";

const n0 = (v: number) => Math.round(v).toLocaleString("en-GB");
const diff = (a: number | null, b: number | null) => (a == null || b == null ? null : a - b);
const LIGHT = { green: "All clear", yellow: "Worth watching", red: "Take it easy", unknown: "" };

/**
 * One Monday-to-Sunday week: a verdict, your averages against last week and your 4-week
 * average, each night, recovery days, weekdays vs weekend, wins, watch-outs and a focus
 * for next week. Everything is worked out in the browser from the same API as the rest.
 */
export function Weekly({ monday, latest }: { monday: string; latest: string }) {
  const data = useLoad(
    () => Promise.all([getTrends(3650), getDays(3650).catch(() => [] as DayRow[])]),
    "weekly-data",
  );
  if (data.kind === "loading") return <div className="skeleton" style={{ height: 320 }} />;
  if (data.kind === "error") return <p className="error">Couldn't load this week: {data.message}</p>;

  const [trends, days] = data.data;
  const r = weeklyReport(trends, days, monday, latest);
  const { week: w, lastWeek: l, fourWeeks: f } = r;

  if (!w.nights) {
    return (
      <Card title={`Week of ${shortDate(monday)}`}>
        <p className="muted">No nights recorded this week.</p>
      </Card>
    );
  }

  return (
    <>
      <Card
        title={`Week of ${shortDate(monday)}`}
        delay={60}
        aside={<span className="sub">{r.complete ? `${w.nights} nights` : `So far: ${w.nights} nights`}</span>}
      >
        <p className="headline">{r.verdict}</p>
        <div className="tiles">
          <Tile label="Sleep score" value={fmt(w.score, (x) => n0(x))} avg4={fmt(f.score, (x) => n0(x))}>
            <Delta diff={diff(w.score, l.score)} format={n0} label="vs last week" />
          </Tile>
          <Tile label="Time asleep" value={fmt(w.duration_h, (h) => hm(h * 3600))} avg4={fmt(f.duration_h, (h) => hm(h * 3600))}>
            <Delta diff={diff(w.duration_h, l.duration_h)} format={(h) => hm(h * 3600)} label="vs last week" />
          </Tile>
          <Tile label="Sleep debt" value={r.debt_h != null ? signedHm(r.debt_h) : "–"}>
            <div className="muted small">this week vs your usual</div>
          </Tile>
          <Tile label="Bedtime" value={fmt(w.bedtime, minToClock)} avg4={fmt(f.bedtime, minToClock)}>
            <div className="muted small">{w.bedtime_spread != null ? `varied ±${Math.round(w.bedtime_spread)} min` : "average"}</div>
          </Tile>
          <Tile label="HRV" value={fmt(w.hrv, (x) => `${n0(x)} ms`)} avg4={fmt(f.hrv, (x) => `${n0(x)} ms`)}>
            <Delta diff={diff(w.hrv, l.hrv)} format={(x) => `${n0(x)} ms`} label="vs last week" />
          </Tile>
          <Tile label="Resting HR" value={fmt(w.resting_hr, (x) => `${n0(x)} bpm`)} avg4={fmt(f.resting_hr, (x) => `${n0(x)} bpm`)}>
            <Delta diff={diff(w.resting_hr, l.resting_hr)} format={(x) => `${n0(x)} bpm`} better="down" label="vs last week" />
          </Tile>
          <Tile label="Steps a day" value={fmt(w.steps, n0)} avg4={fmt(f.steps, n0)}>
            <Delta diff={diff(w.steps, l.steps)} format={n0} label="vs last week" />
          </Tile>
          <Tile label="Stress" value={fmt(w.stress, n0)} avg4={fmt(f.stress, n0)}>
            <Delta diff={diff(w.stress, l.stress)} format={n0} better="down" label="vs last week" />
          </Tile>
        </div>
      </Card>

      <Card
        title="Night by night"
        delay={120}
        aside={
          <span className="sub">
            {r.best ? `Best ${r.best.weekday} (${r.best.score})` : ""}
            {r.worst ? ` · Worst ${r.worst.weekday} (${r.worst.score})` : ""}
          </span>
        }
      >
        <WeekNightsChart cells={r.nightByNight} />
        <div className="legend">
          <span>
            <span className="swatch" style={{ background: "var(--c-sleep)" }} /> Time asleep (score on top)
          </span>
        </div>
        <div className="week-recovery" aria-label="Recovery each day">
          {r.nightByNight.map((c) => (
            <div key={c.date} title={c.recovery ? LIGHT[c.recovery] : "No data"}>
              <span className={`status-dot ${c.recovery ?? ""}`} aria-hidden />
              <span className="muted small">{c.weekday}</span>
            </div>
          ))}
        </div>
        <p className="muted small">
          Recovery: {r.recovery.green} green, {r.recovery.yellow} amber, {r.recovery.red} red
        </p>
      </Card>

      <div className="grid-2">
        <Card title="Wins" delay={180}>
          <List items={r.wins} empty="Nothing stood out this week." />
        </Card>
        <Card title="Watch-outs" delay={210}>
          <List items={r.watchOuts} empty="Nothing to worry about this week." />
        </Card>
      </div>

      <div className="grid-2">
        <Card title="Weekdays vs weekend" delay={240} aside={<span className="sub">Sun–Thu vs Fri–Sat nights</span>}>
          <WeekdayWeekend r={r.weekdayVsWeekend} />
        </Card>
        <Card title="Next week's focus" delay={270} aside={<span className="sub">General tips, not medical advice</span>}>
          <List items={r.focus} empty="Keep going." />
        </Card>
      </div>
    </>
  );
}

const fmt = (v: number | null, f: (x: number) => string) => (v == null ? "–" : f(v));

function Tile({ label, value, avg4, children }: { label: string; value: string; avg4?: string; children?: ReactNode }) {
  return (
    <div className="tile">
      <div className="stat-label">{label}</div>
      <div className="tile-value">{value}</div>
      {children}
      {avg4 && avg4 !== "–" && <div className="muted small">4-week avg {avg4}</div>}
    </div>
  );
}

function List({ items, empty }: { items: string[]; empty: string }) {
  if (!items.length) return <p className="muted">{empty}</p>;
  return (
    <ul className="tips">
      {items.map((t) => (
        <li key={t}>{t}</li>
      ))}
    </ul>
  );
}

function WeekdayWeekend({ r }: { r: { weekday: Side; weekend: Side; shift_min: number | null } }) {
  const rows: [string, (s: Side) => string][] = [
    ["Asleep at", (s) => fmt(s.bedtime, minToClock)],
    ["Time asleep", (s) => fmt(s.duration_h, (h) => hm(h * 3600))],
    ["Sleep score", (s) => fmt(s.score, n0)],
  ];
  return (
    <>
      <table className="table">
        <thead>
          <tr>
            <th />
            <th className="num">Weekdays ({r.weekday.nights})</th>
            <th className="num">Weekend ({r.weekend.nights})</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([label, get]) => (
            <tr key={label}>
              <td>{label}</td>
              <td className="num">{get(r.weekday)}</td>
              <td className="num">{get(r.weekend)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {r.shift_min != null && Math.abs(r.shift_min) >= 15 && (
        <p className="muted small">
          Weekend bedtime is {hm(Math.abs(r.shift_min) * 60)} {r.shift_min > 0 ? "later" : "earlier"} than weekdays.
        </p>
      )}
    </>
  );
}

type Side = Pick<WeekStats, "nights" | "bedtime" | "duration_h" | "score">;
