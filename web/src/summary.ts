import type { ActivityRow, DayRow, Night } from "./api";
import type { Recovery } from "./recovery";
import { clock, hm, type Baseline, stageSplit } from "./sleep";
import { bedtimeMin } from "./tips";

/**
 * The one-line verdict above "In short": how good the night was, and whether it was short.
 */
export function headline(night: Night, usual: Baseline, recovery?: Recovery | null): string {
  const hours = night.duration_s / 3600;
  const s = night.score;
  let line =
    s == null
      ? hours >= 7
        ? "A full night"
        : "A short night"
      : s >= 85
        ? "A great night"
        : s >= 75
          ? "A good night"
          : s >= 60
            ? "An OK night"
            : "A poor night";
  const short = hours < 6.5 || (usual.duration_h != null && hours < usual.duration_h - 0.5);
  if (s != null && short) line += s >= 75 ? ", if a bit short" : ", and a short one";
  line += ".";
  if (recovery?.level === "red") line += " Your body looks under strain today.";
  else if (recovery?.level === "yellow") line += " One recovery signal is off.";
  return line;
}

const n = (v: number) => Math.round(v).toLocaleString("en-GB");

/**
 * Last night in a few plain sentences, built from the numbers with simple rules (no AI).
 * Each sentence only appears when there's something to say, so a quiet night reads short.
 * `usual` is the 7 nights before; `day` is the day that led into the night.
 */
export function writeSummary(
  night: Night,
  usual: Baseline,
  day?: DayRow | null,
  workouts: ActivityRow[] = [],
): string[] {
  const out: string[] = [];

  // Time asleep, against usual. Under 10 minutes either way counts as "about usual".
  const hours = night.duration_s / 3600;
  let slept = `You slept ${hm(night.duration_s)}`;
  if (usual.duration_h != null) {
    const diffMin = (hours - usual.duration_h) * 60;
    slept += Math.abs(diffMin) < 10 ? ", about your usual" : `, ${hm(Math.abs(diffMin) * 60)} ${diffMin > 0 ? "more" : "less"} than usual`;
  }
  let window = `from ${clock(night.start_ts, night.tz_offset_min)} to ${clock(night.end_ts, night.tz_offset_min)}`;
  // Bedtime drift matters more than the exact time: mention it when it's 30+ minutes off.
  if (usual.bedtime != null) {
    const drift = bedtimeMin(night) - usual.bedtime;
    if (Math.abs(drift) >= 30) window += ` (bedtime ${hm(Math.abs(drift) * 60)} ${drift > 0 ? "later" : "earlier"} than usual)`;
  }
  out.push(`${slept}, ${window}.`);

  // Score, against the weekly average. A gap under 3 points isn't worth a sentence of its own.
  if (night.score != null) {
    const diff = usual.score == null ? 0 : night.score - usual.score;
    out.push(
      Math.abs(diff) < 3
        ? `Your sleep score was ${night.score}, in line with your week.`
        : `Your sleep score was ${night.score}, ${n(Math.abs(diff))} ${diff > 0 ? "above" : "below"} your weekly average.`,
    );
  }

  // Stages: call out deep sleep when it's notably high or low (typical adults: roughly 13–23%).
  const split = Object.fromEntries(stageSplit(night).map((s) => [s.key, s]));
  const deep = split.deep;
  if (deep.seconds) {
    const pct = Math.round(deep.share * 100);
    const remPct = Math.round(split.rem.share * 100);
    const verdict = pct >= 20 ? "a good amount of deep sleep" : pct < 13 ? "less deep sleep than ideal" : "a normal amount of deep sleep";
    out.push(`You got ${verdict} (${hm(deep.seconds)}, ${pct}%) and ${remPct}% REM.`);
  }

  // Waking up a lot is worth mentioning; a few minutes awake is normal.
  if ((night.awake_s ?? 0) >= 30 * 60) out.push(`You were awake for ${hm(night.awake_s)} during the night.`);

  // Recovery signals: HRV up is good, resting HR up is usually not.
  const recovery: string[] = [];
  if (night.hrv_avg != null && usual.hrv != null && Math.abs(night.hrv_avg - usual.hrv) >= 3) {
    recovery.push(`HRV was ${night.hrv_avg > usual.hrv ? "up" : "down"} ${n(Math.abs(night.hrv_avg - usual.hrv))} ms`);
  }
  if (night.resting_hr != null && usual.resting_hr != null && Math.abs(night.resting_hr - usual.resting_hr) >= 2) {
    recovery.push(
      `resting heart rate was ${night.resting_hr > usual.resting_hr ? "up" : "down"} ${n(Math.abs(night.resting_hr - usual.resting_hr))} bpm`,
    );
  }
  if (recovery.length) {
    const text = recovery.join(" and ");
    out.push(`${text[0].toUpperCase()}${text.slice(1)} on your usual.`);
  }

  // The day before: what led into the night.
  if (day) {
    const bits: string[] = [];
    if (day.steps != null) bits.push(`${n(day.steps)} steps`);
    for (const w of workouts.slice(0, 2)) {
      if (w.duration_s) bits.push(`${hm(w.duration_s)} of ${(w.name ?? w.type ?? "exercise").toLowerCase()}`);
    }
    if (day.stress_avg != null) bits.push(`average stress ${day.stress_avg}`);
    if (day.bb_high != null) bits.push(`Body Battery peaking at ${day.bb_high}`);
    if (bits.length) out.push(`The day before: ${bits.join(", ")}.`);
  }
  return out;
}
