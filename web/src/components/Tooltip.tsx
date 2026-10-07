import type { ReactNode } from "react";

export interface TipRow {
  label: string;
  value: ReactNode;
  color?: string;
  shape?: "line" | "dot" | "square";
}

/** The one tooltip look shared by every chart. Text stays in ink; colour is only the swatch. */
export function Tip({ title, rows }: { title: ReactNode; rows: TipRow[] }) {
  return (
    <div className="tip">
      <div className="tip-title">{title}</div>
      {rows.map((r) => (
        <div className="tip-row" key={r.label}>
          <span className="label">
            {r.color && <span className={`swatch ${r.shape ?? "square"}`} style={{ background: r.color }} />}
            {r.label}
          </span>
          <span className="value">{r.value}</span>
        </div>
      ))}
    </div>
  );
}
