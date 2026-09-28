import type { ExerciseSet, ExerciseTypeStats } from "@/features/exercises/api";

export const getSetPersonalBest = (
  stats: Pick<ExerciseTypeStats, "personalBest" | "sidePersonalBests">,
  side: ExerciseSet["side"],
) => stats.sidePersonalBests !== undefined
  ? stats.sidePersonalBests?.[side ?? "both"] ?? null
  : stats.personalBest;

export const getPersonalBestEntries = (stats: ExerciseTypeStats) => {
  if (stats.sidePersonalBests != null) {
    const labels = { left: "Left", right: "Right", both: "Both sides", unspecified: "Unspecified" };
    return (Object.keys(labels) as Array<keyof typeof labels>).flatMap((side) => {
      const best = stats.sidePersonalBests?.[side];
      return best ? [{ label: labels[side], best }] : [];
    });
  }
  return stats.personalBest ? [{ label: "Personal Record", best: stats.personalBest }] : [];
};
