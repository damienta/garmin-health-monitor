/**
 * Shaping chart data so every chart on a page lines up:
 * - padDates fills in missing days, so all charts start and end on the same date
 *   (a day with no data is a gap, not a shorter chart)
 * - toWeeks averages rows into Monday-to-Sunday weeks for long ranges, so a year is
 *   about 52 bars instead of 365
 */

export const addDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/** Ranges this long or longer are drawn as weekly averages. */
export const WEEKLY_FROM = 90;

/** One row per date from `from` to `to`; dates with no data get `empty(date)`. */
export function padDates<T extends { date: string }>(rows: T[], from: string, to: string, empty: (date: string) => T): T[] {
  if (from > to) return [];
  const byDate = new Map(rows.map((r) => [r.date, r]));
  const out: T[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(byDate.get(d) ?? empty(d));
  return out;
}

/** The Monday of the week a date falls in. */
export function weekStart(iso: string): string {
  const day = new Date(`${iso}T00:00:00Z`).getUTCDay(); // 0 = Sunday
  return addDays(iso, -((day + 6) % 7));
}

/**
 * Averages every numeric field per week, ignoring missing values. The row's date
 * becomes the week's Monday. `skip` fields (like 7-day averages) are set to null,
 * since a weekly average already smooths the line.
 */
export function toWeeks<T extends { date: string }>(rows: T[], skip: (keyof T)[] = []): T[] {
  const groups = new Map<string, T[]>();
  for (const r of rows) {
    const w = weekStart(r.date);
    groups.set(w, [...(groups.get(w) ?? []), r]);
  }
  return [...groups.entries()].map(([date, rs]) => {
    const out: Record<string, unknown> = { date };
    for (const key of Object.keys(rs[0]) as (keyof T & string)[]) {
      if (key === "date") continue;
      if (skip.includes(key)) {
        out[key] = null;
        continue;
      }
      const nums = rs.map((r) => r[key]).filter((v): v is T[typeof key] & number => typeof v === "number");
      out[key] = nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null;
    }
    return out as T;
  });
}
