import { formatDecimal } from "@/utils/format";
import { formatDurationInputValue } from "./setValue";

export type SetSummaryInput = {
  reps?: number | null;
  duration_seconds?: number | null;
  intensity?: number | null;
  rpe?: number | null;
  rir?: number | null;
  intensityUnitAbbreviation?: string | null;
};

export const formatDurationSeconds = (
  durationSeconds: number | null | undefined,
): string | null => {
  if (durationSeconds == null || durationSeconds === 0) {
    return null;
  }

  return formatDurationInputValue(durationSeconds);
};

export const formatSetSummary = ({
  reps,
  duration_seconds,
  intensity,
  rpe,
  rir,
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

  if (rpe != null) {
    const formatted = formatDecimal(rpe);
    if (formatted !== "-") {
      parts.push(`RPE ${formatted}`);
    }
  }

  if (rir != null) {
    const formatted = formatDecimal(rir);
    if (formatted !== "-") {
      parts.push(`RIR ${formatted}`);
    }
  }

  return parts.length > 0 ? parts.join(" ") : "No targets set";
};
