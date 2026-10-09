import type { Page } from "../useRoute";

/** The page switch: same pill style as the range picker, made of links. */
export function Nav({ page }: { page: Page }) {
  return (
    <nav className="segmented nav" aria-label="Pages">
      <a href="#/" aria-current={page === "night" ? "page" : undefined}>
        Last night
      </a>
      <a href="#/all" aria-current={page === "all" ? "page" : undefined}>
        All time
      </a>
    </nav>
  );
}
