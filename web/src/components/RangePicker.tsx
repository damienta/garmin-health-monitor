export const RANGES = [7, 30, 90, 3650] as const;
export type Range = (typeof RANGES)[number];

const label = (r: Range) => (r === 3650 ? "All" : `${r} days`);

/** Pill-shaped segmented control: last 7, 30 or 90 nights, or everything. */
export function RangePicker({ value, onChange }: { value: Range; onChange: (r: Range) => void }) {
  return (
    <div className="segmented" role="group" aria-label="Time range">
      {RANGES.map((r) => (
        <button key={r} type="button" aria-pressed={value === r} onClick={() => onChange(r)}>
          {label(r)}
        </button>
      ))}
    </div>
  );
}

export const rangeText = (r: Range) => (r === 3650 ? "All nights" : `Last ${r} nights`);
