export type SetValueLike = {
  reps?: number | null;
  duration_seconds?: number | null;
};

export type SetValueMode = "reps" | "time";

export const resolveSetValueMode = (
  set: SetValueLike | null | undefined,
  prefersTimeByDefault = false,
): SetValueMode => {
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

  return /^\d{0,3}(?::\d{0,2})?$/.test(normalized);
};

export const parseDurationInputValue = (
  value: string,
): number | null => {
  const normalized = value.trim();

  if (normalized === "") {
    return null;
  }

  const match = normalized.match(/^(\d{1,3}):([0-5]\d)$/);
  if (!match) {
    return null;
  }

  return (
    Number.parseInt(match[1], 10) * 60 +
    Number.parseInt(match[2], 10)
  );
};
