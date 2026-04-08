import { formatDecimal } from "@/utils/format";

export type SetSummaryInput = {
  reps?: number | null;
  duration_seconds?: number | null;
  intensity?: number | null;
  intensityUnitAbbreviation?: string | null;
};

export const formatDurationSeconds = (
  durationSeconds: number | null | undefined,
): string | null => {
  if (durationSeconds == null) {
    return null;
  }

  if (durationSeconds % 60 === 0) {
    return `${durationSeconds / 60} min`;
  }

  return `${durationSeconds} sec`;
};

export const formatSetSummary = ({
  reps,
  duration_seconds,
  intensity,
  intensityUnitAbbreviation,
}: SetSummaryInput): string => {
  const parts: string[] = [];

  const duration = formatDurationSeconds(duration_seconds);
  if (duration) {
    parts.push(duration);
  } else if (reps != null) {
    parts.push(`${reps} reps`);
  }

  if (intensity != null) {
    const formatted = formatDecimal(intensity);
    const suffix = intensityUnitAbbreviation ? ` ${intensityUnitAbbreviation}` : "";
    if (formatted !== "-") {
      parts.push(`@ ${formatted}${suffix}`);
    }
  }

  return parts.length > 0 ? parts.join(" ") : "No targets set";
};
