import { useEffect, useState } from "react";

export type Page = "night" | "all";

/** Two pages, picked by the URL hash (#/ or #/all), so the back button and bookmarks work. */
export function useRoute(): Page {
  const read = (): Page => (window.location.hash === "#/all" ? "all" : "night");
  const [page, setPage] = useState<Page>(read);
  useEffect(() => {
    const onChange = () => {
      setPage(read());
      window.scrollTo({ top: 0 });
    };
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return page;
}
