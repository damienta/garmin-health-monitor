import type { MouseEvent } from "react";
import { PATHS, type Page } from "../routes";
import { go } from "../useRoute";

const LABELS: Record<Page, string> = { yesterday: "Yesterday", trends: "Trends" };

/** The page switch: same pill style as the range picker, made of real links. */
export function Nav({ page }: { page: Page }) {
  const open = (p: Page) => (e: MouseEvent) => {
    // Let ctrl/cmd-click open a new tab as normal.
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    go(p);
  };
  return (
    <nav className="segmented nav" aria-label="Pages">
      {(Object.keys(PATHS) as Page[]).map((p) => (
        <a key={p} href={PATHS[p]} onClick={open(p)} aria-current={page === p ? "page" : undefined}>
          {LABELS[p]}
        </a>
      ))}
    </nav>
  );
}
