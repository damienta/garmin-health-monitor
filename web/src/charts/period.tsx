import { createContext, useContext } from "react";
import { longDate, shortDate } from "../format";

/**
 * Whether the charts on a page show one point per day or weekly averages. Set once for
 * the page (by the range picker) instead of passed to every chart.
 */
export const WeeklyContext = createContext(false);

export function usePeriod() {
  const weekly = useContext(WeeklyContext);
  return {
    weekly,
    /** Tooltip title: "Tue 6 Oct", or "Week of 5 Oct" in weekly mode. */
    title: (date: string) => (weekly ? `Week of ${shortDate(date)}` : longDate(date)),
  };
}
