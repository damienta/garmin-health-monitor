import type { DayRow, Night } from "./api";
import type { Recovery } from "./recovery";
import { type Baseline, stageSplit } from "./sleep";
import { minToClock } from "./charts/bedtime";

/** Bedtime as minutes from local midnight (23:30 is -30), same as the API's bedtime_min. */
export const bedtimeMin = (n: Pick<Night, "start_ts" | "tz_offset_min">) =>
  ((Math.floor(((n.start_ts + n.tz_offset_min * 60) % 86400) / 60) + 720) % 1440 + 1440) % 1440 - 720;

/**
 * "Try this": up to three practical suggestions picked by simple rules from last night
 * and the day before. General sleep hygiene, not medical advice. Most important first.
 */
export function writeTips(night: Night, usual: Baseline, day: DayRow | null, recovery: Recovery): string[] {
  const tips: string[] = [];
  const bed = bedtimeMin(night);
  const hours = night.duration_s / 3600;

  if (recovery.level === "red" || recovery.level === "yellow") {
    tips.push("Your recovery signals are off. Make today an easy day: skip hard training, drink water, and get to bed early.");
  }

  const underUsual = usual.duration_h != null && hours < usual.duration_h - 0.5;
  if (hours < 7 || underUsual) {
    // 30 minutes before your usual (or last night's) bedtime, rounded down to a quarter hour.
    const target = Math.floor(((usual.bedtime != null ? Math.min(bed, usual.bedtime) : bed) - 30) / 15) * 15;
    const why = underUsual ? "You slept less than usual" : "You slept under 7 hours";
    tips.push(`${why}. Aim to be asleep by ${minToClock(target)} tonight to catch up.`);
  }

  if (usual.bedtime != null && bed - usual.bedtime >= 45) {
    tips.push(
      `You fell asleep ${minToClock(bed)}, later than your usual ${minToClock(usual.bedtime)}. A steady bedtime is one of the easiest ways to sleep better.`,
    );
  }

  const deep = stageSplit(night).find((s) => s.key === "deep");
  if (deep && deep.seconds && deep.share < 0.13) {
    tips.push("Deep sleep was low. Alcohol, late heavy meals and a warm room all cut it; an active day usually helps.");
  }

  if ((night.awake_s ?? 0) >= 30 * 60) {
    tips.push("You woke up a lot. Keep the room cool and dark, and keep caffeine to before 2pm.");
  }

  if (day?.stress_avg != null && day.stress_avg >= 40) {
    tips.push(`Yesterday was stressful (average ${day.stress_avg}). Try 10 minutes of slow breathing or a walk before bed.`);
  }

  if (day?.steps != null && day.steps < 5000) {
    tips.push(`Only ${day.steps.toLocaleString("en-GB")} steps yesterday. A 20 to 30 minute walk today, ideally in daylight, tends to help tonight's sleep.`);
  }

  if (!tips.length) {
    tips.push(
      `Nothing to fix. Keep the same routine: asleep around ${minToClock(usual.bedtime ?? bed)} and plenty of daylight in the morning.`,
    );
  }
  return tips.slice(0, 3);
}
