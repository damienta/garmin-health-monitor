import type { DayRow, NightRow } from "../api";
import { longDate } from "../format";
import { computeRecords, STREAK_SCORE } from "../records";
import { hm } from "../sleep";

/** Personal bests at a glance: a grid of tiles, each a number with what it means and when. */
export function RecordsCard({ nights, days }: { nights: NightRow[]; days: DayRow[] }) {
  const r = computeRecords(nights, days);
  const tiles: { label: string; value: string; note?: string }[] = [
    { label: "Best night", value: r.best ? String(r.best.score) : "–", note: r.best ? longDate(r.best.date) : undefined },
    { label: "Worst night", value: r.worst ? String(r.worst.score) : "–", note: r.worst ? longDate(r.worst.date) : undefined },
    { label: "Longest sleep", value: r.longest ? hm(r.longest.duration_s) : "–", note: r.longest ? longDate(r.longest.date) : undefined },
    { label: "Average score", value: r.avgScore != null ? String(Math.round(r.avgScore)) : "–", note: `${r.nights} nights` },
    { label: "Average sleep", value: r.avgDuration != null ? hm(r.avgDuration) : "–", note: r.first ? `since ${longDate(r.first)}` : undefined },
    { label: `Current ${STREAK_SCORE}+ streak`, value: `${r.streak}`, note: r.streak === 1 ? "night" : "nights in a row" },
    { label: `Best ${STREAK_SCORE}+ streak`, value: `${r.bestStreak}`, note: "nights in a row" },
    {
      label: "Most steps",
      value: r.mostSteps?.steps != null ? r.mostSteps.steps.toLocaleString("en-GB") : "–",
      note: r.mostSteps ? longDate(r.mostSteps.date) : undefined,
    },
  ];
  return (
    <div className="tiles">
      {tiles.map((t) => (
        <div className="tile" key={t.label}>
          <div className="stat-label">{t.label}</div>
          <div className="tile-value">{t.value}</div>
          {t.note && <div className="muted small">{t.note}</div>}
        </div>
      ))}
    </div>
  );
}
