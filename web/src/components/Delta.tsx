/**
 * "▲ 12m vs usual". Arrow + words carry the meaning; green/red only reinforces it.
 * `better` says which direction is good (resting HR: lower is better).
 */
export function Delta({
  diff,
  format,
  better = "up",
}: {
  diff: number | null;
  format: (abs: number) => string;
  better?: "up" | "down";
}) {
  if (diff == null) return <span className="delta muted">no average yet</span>;
  const abs = Math.abs(diff);
  if (format(abs) === format(0)) return <span className="delta muted">= usual</span>;
  const up = diff > 0;
  const good = up === (better === "up");
  return (
    <span className={`delta ${good ? "good" : "bad"}`}>
      {up ? "▲" : "▼"} {format(abs)} <span className="muted">vs usual</span>
    </span>
  );
}
