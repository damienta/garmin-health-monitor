/** A padded range snapped to round numbers, with ticks every 5 or 10. */
export function niceRange(values: (number | null)[]): { domain: [number, number]; ticks: number[] } {
  const v = values.filter((x): x is number => x != null);
  if (!v.length) return { domain: [0, 10], ticks: [0, 5, 10] };
  const step = Math.max(...v) - Math.min(...v) > 20 ? 10 : 5;
  const lo = Math.floor((Math.min(...v) - 2) / step) * step;
  const hi = Math.ceil((Math.max(...v) + 2) / step) * step;
  const ticks = [];
  for (let t = lo; t <= hi; t += step) ticks.push(t);
  return { domain: [lo, hi], ticks };
}
