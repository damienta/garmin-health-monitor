import { type Comparison, MIN_GROUP, REAL_DIFF } from "../insights";

/**
 * Your sleep score after different kinds of day. Each factor gets one plain sentence
 * naming the side you sleep better on, and two bars: the better side in the score
 * colour, the other in grey. Gaps under 3 points read as no clear difference.
 */
export function WhatHelps({ items }: { items: Comparison[] }) {
  if (!items.length) {
    return <p className="muted">Needs at least {MIN_GROUP} nights on each side of a comparison. Check back in a week or two.</p>;
  }
  return (
    <div className="helps">
      {items.map((c) => {
        const win = c.diff >= 0 ? c.a : c.b;
        const clear = Math.abs(c.diff) >= REAL_DIFF;
        return (
          <div className="helps-row" key={c.factor}>
            <div className="stat-label">{c.factor}</div>
            <p className="helps-text">
              {clear ? (
                <>
                  Your score is <strong>{Math.round(Math.abs(c.diff))} points higher</strong> {win.phrase}.
                </>
              ) : (
                <>No clear difference yet.</>
              )}
            </p>
            <Bar label={c.a.label} score={c.a.score} nights={c.a.nights} highlight={clear && win === c.a} />
            <Bar label={c.b.label} score={c.b.score} nights={c.b.nights} highlight={clear && win === c.b} />
          </div>
        );
      })}
    </div>
  );
}

function Bar({ label, score, nights, highlight }: { label: string; score: number; nights: number; highlight: boolean }) {
  return (
    <div className="helps-bar" title={`${nights} nights`}>
      <span className="helps-label">{label}</span>
      <span className="helps-track">
        <span style={{ width: `${Math.max(0, Math.min(100, score))}%`, background: highlight ? "var(--c-score)" : "var(--bar)" }} />
      </span>
      <span className="helps-value">{Math.round(score)}</span>
    </div>
  );
}
