import { type Comparison, MIN_GROUP } from "../insights";

/**
 * Your sleep score after different kinds of day, side by side. Two quiet bars per factor
 * (ink for the first group, grey for the second) and a plain sentence with the gap.
 */
export function WhatHelps({ items }: { items: Comparison[] }) {
  if (!items.length) {
    return <p className="muted">Needs at least {MIN_GROUP} nights on each side of a comparison. Check back in a week or two.</p>;
  }
  return (
    <div className="helps">
      {items.map((c) => {
        const small = Math.abs(c.diff) < 2;
        return (
          <div className="helps-row" key={c.factor}>
            <div className="stat-label">{c.factor}</div>
            <p className="helps-text">
              {small ? (
                <>No real difference ({Math.round(c.a.score)} vs {Math.round(c.b.score)}).</>
              ) : (
                <>
                  You score <strong>{Math.round(Math.abs(c.diff))} points {c.diff > 0 ? "higher" : "lower"}</strong> after{" "}
                  {c.a.label} than after {c.b.label}.
                </>
              )}
            </p>
            <Bar label={c.a.label} score={c.a.score} nights={c.a.nights} ink />
            <Bar label={c.b.label} score={c.b.score} nights={c.b.nights} />
          </div>
        );
      })}
      <p className="muted small">Average sleep score the night after. Correlation, not proof: other things change too.</p>
    </div>
  );
}

function Bar({ label, score, nights, ink = false }: { label: string; score: number; nights: number; ink?: boolean }) {
  return (
    <div className="helps-bar" title={`${nights} nights`}>
      <span className="helps-label">{label}</span>
      <span className="helps-track">
        <span style={{ width: `${Math.max(0, Math.min(100, score))}%`, background: ink ? "var(--ink)" : "var(--bar)" }} />
      </span>
      <span className="helps-value">{Math.round(score)}</span>
    </div>
  );
}
