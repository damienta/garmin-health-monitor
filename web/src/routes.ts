export type Page = "yesterday" | "trends";

export const PATHS: Record<Page, string> = { yesterday: "/", trends: "/trends" };

/** Which page a URL shows. Old #/all bookmarks still land on Trends. */
export function pageFor(path: string, hash = ""): Page {
  if (hash === "#/all" || path.replace(/\/+$/, "") === "/trends") return "trends";
  return "yesterday";
}
