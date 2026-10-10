export type Page = "daily" | "trends";

export const PATHS: Record<Page, string> = { daily: "/", trends: "/trends" };

/** ?day=2026-10-09 picks the day on the Daily page; anything else means "latest". */
export function dayParam(search: string): string | null {
  const d = new URLSearchParams(search).get("day");
  return d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null;
}

/** Which page a URL shows. Old #/all bookmarks still land on Trends. */
export function pageFor(path: string, hash = ""): Page {
  if (hash === "#/all" || path.replace(/\/+$/, "") === "/trends") return "trends";
  return "daily";
}
