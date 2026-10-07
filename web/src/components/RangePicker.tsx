export const RANGES = [7, 30, 90] as const;
export type Range = (typeof RANGES)[number];

/** Pill-shaped segmented control: last 7, 30 or 90 nights. */
export function RangePicker({ value, onChange }: { value: Range; onChange: (r: Range) => void }) {
  return (
    <div className="segmented" role="group" aria-label="Time range">
      {RANGES.map((r) => (
        <button key={r} type="button" aria-pressed={value === r} onClick={() => onChange(r)}>
          {r} days
        </button>
      ))}
    </div>
  );
}
