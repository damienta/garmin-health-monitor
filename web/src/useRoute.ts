import { useEffect, useState } from "react";

import { pageFor, PATHS, type Page } from "./routes";

export type { Page };

/**
 * Two pages at clean URLs (/ and /trends). Cloudflare serves index.html for any path
 * (not_found_handling: single-page-application), and links switch pages with
 * history.pushState, so there's no reload and the back button still works.
 */
export function useRoute(): Page {
  const read = () => pageFor(window.location.pathname, window.location.hash);
  const [page, setPage] = useState<Page>(read);
  useEffect(() => {
    // Tidy an old #/ or #/all bookmark into the clean URL.
    if (window.location.hash.startsWith("#/")) window.history.replaceState(null, "", PATHS[read()]);
    const onChange = () => {
      setPage(read());
      window.scrollTo({ top: 0 });
    };
    window.addEventListener("popstate", onChange);
    window.addEventListener("navigate-page", onChange);
    return () => {
      window.removeEventListener("popstate", onChange);
      window.removeEventListener("navigate-page", onChange);
    };
  }, []);
  return page;
}

/** Go to a page without reloading. */
export function go(page: Page) {
  if (window.location.pathname === PATHS[page]) return;
  window.history.pushState(null, "", PATHS[page]);
  window.dispatchEvent(new Event("navigate-page"));
}
