import { useEffect, useState } from "react";

export type Loaded<T> = { kind: "loading" } | { kind: "error"; message: string } | { kind: "ready"; data: T };

/** Load a value and track loading/error. Re-runs when `key` changes; ignores stale replies. */
export function useLoad<T>(load: () => Promise<T>, key: string): Loaded<T> {
  const [state, setState] = useState<Loaded<T>>({ kind: "loading" });
  useEffect(() => {
    let live = true;
    setState({ kind: "loading" });
    load()
      .then((data) => live && setState({ kind: "ready", data }))
      .catch((e: unknown) => live && setState({ kind: "error", message: e instanceof Error ? e.message : String(e) }));
    return () => {
      live = false;
    };
  }, [key]);
  return state;
}
