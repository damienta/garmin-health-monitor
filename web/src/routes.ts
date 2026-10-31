export type Page = "daily" | "weekly" | "trends";

export const PATHS: Record<Page, string> = { daily: "/", weekly: "/weekly", trends: "/trends" };

/** ?day=2026-10-09 picks the day on the Daily page; anything else means "latest". */
export function dayParam(search: string): string | null {
  const d = new URLSearchParams(search).get("day");
  return d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null;
}

/** ?week=2026-10-19 picks the week (its Monday) on the Weekly page. */
export function weekParam(search: string): string | null {
  const w = new URLSearchParams(search).get("week");
  return w && /^\d{4}-\d{2}-\d{2}$/.test(w) ? w : null;
}

/** Which page a URL shows. Old #/all bookmarks still land on Trends. */
export function pageFor(path: string, hash = ""): Page {
  const p = path.replace(/\/+$/, "");
  if (hash === "#/all" || p === "/trends") return "trends";
  if (p === "/weekly") return "weekly";
  return "daily";
}
