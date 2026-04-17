export type SetValueLike = {
  reps?: number | null;
  duration_seconds?: number | null;
};

export type SetValueMode = "reps" | "time";

export const resolveSetValueMode = (
  set: (SetValueLike & { type?: string | null }) | null | undefined,
  prefersTimeByDefault = false,
): SetValueMode => {
  if (set?.type === "time") {
    return "time";
  }
  if (set?.type === "reps") {
    return "reps";
  }

  if (set?.duration_seconds != null) {
    return "time";
  }

  if (set?.reps != null) {
    return "reps";
  }

  return prefersTimeByDefault ? "time" : "reps";
};

export const formatDurationInputValue = (
  durationSeconds: number | null | undefined,
): string => {
  if (
    durationSeconds == null ||
    !Number.isFinite(durationSeconds) ||
    durationSeconds < 0
  ) {
    return "";
  }

  const totalSeconds = Math.floor(durationSeconds);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
};

export const canUpdateDurationInputValue = (value: string): boolean => {
  const normalized = value.trim();

  if (normalized === "") {
    return true;
  }

  return /^:?\d{0,3}(?::\d{0,2})?$/.test(normalized);
};

export const parseDurationInputValue = (
  value: string,
): number | null => {
  const normalized = value.trim();

  if (normalized === "") {
    return null;
  }

  // Handle plain seconds (no colon)
  if (/^\d+$/.test(normalized)) {
    return Number.parseInt(normalized, 10);
  }

  // Handle MM:SS or M:S or :S
  const match = normalized.match(/^(\d{0,3}):(\d{0,2})$/);
  if (!match) {
    return null;
  }

  const minutes = match[1] === "" ? 0 : Number.parseInt(match[1], 10);
  const seconds = match[2] === "" ? 0 : Number.parseInt(match[2], 10);

  return minutes * 60 + seconds;
};
