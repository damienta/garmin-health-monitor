/**
 * Starts the collect workflow on GitHub at a fixed time.
 *
 * GitHub's own cron runs hours late when it's busy (09:23 often became ~16:20).
 * Cloudflare Cron Triggers fire on time, so the Worker asks GitHub to run the
 * workflow now ("workflow_dispatch"), which GitHub starts within seconds.
 */
export const WORKFLOW = "collect.yml";

export type DispatchEnv = { GITHUB_REPO?: string; GITHUB_DISPATCH_TOKEN?: string };

export type DispatchResult = { ok: true } | { ok: false; reason: string };

/** Days to re-fetch: 3 normally, 14 on Sundays to catch anything older that was missed. */
export const daysFor = (when: Date) => (when.getUTCDay() === 0 ? "14" : "3");

export async function dispatchCollect(
  env: DispatchEnv,
  fetchFn: typeof fetch = fetch,
  when: Date = new Date(),
): Promise<DispatchResult> {
  const repo = env.GITHUB_REPO;
  const token = env.GITHUB_DISPATCH_TOKEN;
  // Not set up yet: do nothing. GitHub's own (late) schedule still runs as a backup.
  if (!repo || !token) return { ok: false, reason: "GITHUB_REPO or GITHUB_DISPATCH_TOKEN not set" };

  const res = await fetchFn(`https://api.github.com/repos/${repo}/actions/workflows/${WORKFLOW}/dispatches`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      // GitHub rejects requests without a User-Agent.
      "User-Agent": "garmin-health-monitor-worker",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ref: "main", inputs: { days: daysFor(when) } }),
  });
  // GitHub answers 204 No Content when the run was queued.
  if (res.status === 204) return { ok: true };
  return { ok: false, reason: `GitHub answered ${res.status}: ${(await res.text()).slice(0, 200)}` };
}
