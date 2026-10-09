import { CartesianGrid, XAxis, YAxis } from "recharts";
import { shortDate } from "../format";

/**
 * Shared chart chrome: hairline grid, quiet axes. Recharts finds children by type, so
 * these are called as functions ({xAxis()}) rather than rendered as components.
 */
export const grid = () => <CartesianGrid stroke="var(--grid)" vertical={false} />;

export const xAxis = () => (
  <XAxis
    dataKey="date"
    tickFormatter={shortDate}
    stroke="var(--axis)"
    tick={{ fill: "var(--muted)", fontSize: 12 }}
    tickLine={false}
    minTickGap={32}
  />
);

export const yAxis = (
  props: { domain?: [number, number]; ticks?: number[]; unit?: string; tickFormatter?: (v: number) => string } = {},
) => (
  <YAxis
    {...props}
    stroke="var(--axis)"
    tick={{ fill: "var(--muted)", fontSize: 12 }}
    tickLine={false}
    axisLine={false}
    width={44}
    allowDecimals={false}
  />
);

export const cursorLine = { stroke: "var(--axis)", strokeWidth: 1 };
export const cursorBand = { fill: "var(--wash)" };

