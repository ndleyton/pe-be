import type {
  Exercise,
  ExerciseSet,
  IntensityUnit,
  PersonalBestData,
} from "@/features/exercises/api";
import type { GuestExerciseSet } from "@/stores";
import { formatDecimal } from "@/utils/format";
import {
  convertIntensityValue,
  type GuestIntensityUnit,
} from "@/features/exercises/lib/intensityUnits";
import { formatDurationInputValue } from "@/features/exercises/lib/setValue";

export interface ExerciseRowProps {
  exercise: Exercise;
  onExerciseUpdate?: (updatedExercise: Exercise) => void;
  onExerciseDelete?: (exerciseId: number | string) => void;
  workoutId?: string;
  isExpanded?: boolean;
  onToggleExpand?: (exerciseId: number | string) => void;
}

export const DEFAULT_INTENSITY_UNIT: IntensityUnit | GuestIntensityUnit = {
  id: 1,
  name: "Kilograms",
  abbreviation: "kg",
};

export const EXERCISE_SETS_GRID_CLASSES =
  "grid-cols-[30px_60px_minmax(0,1fr)_40px_32px] md:grid-cols-[32px_72px_minmax(0,1fr)_44px_36px] lg:grid-cols-[36px_88px_minmax(0,1fr)_48px_40px]";

export const formatIntensityInputValue = (
  value: ExerciseSet["intensity"],
): string => {
  const formatted = formatDecimal(value);
  return formatted === "-" ? "" : formatted;
};

export const buildIntensityInputs = (
  sets: ExerciseSet[],
  displayUnitId?: number,
): Record<string, string> =>
  sets.reduce<Record<string, string>>((acc, set) => {
    acc[String(set.id)] = formatIntensityInputValue(
      convertIntensityValue(set.intensity, set.intensity_unit_id, displayUnitId) ??
        set.intensity,
    );
    return acc;
  }, {});

export const buildRepsInputs = (sets: ExerciseSet[]): Record<string, string> =>
  sets.reduce<Record<string, string>>((acc, set) => {
    acc[String(set.id)] =
      set.reps === null || set.reps === undefined ? "" : String(set.reps);
    return acc;
  }, {});

export const buildDurationInputs = (
  sets: ExerciseSet[],
): Record<string, string> =>
  sets.reduce<Record<string, string>>((acc, set) => {
    acc[String(set.id)] = formatDurationInputValue(set.duration_seconds);
    return acc;
  }, {});

const parseExerciseSetCreatedAt = (value: string): number => {
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? Number.MAX_SAFE_INTEGER : timestamp;
};

const parseExerciseSetId = (value: string | number): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && /^\d+$/.test(value)) {
    return Number.parseInt(value, 10);
  }

  return null;
};

export const sortExerciseSets = (sets: ExerciseSet[]): ExerciseSet[] =>
  [...sets]
    .map((set, index) => ({ set, index }))
    .sort((left, right) => {
      const createdAtDiff =
        parseExerciseSetCreatedAt(left.set.created_at) -
        parseExerciseSetCreatedAt(right.set.created_at);

      if (createdAtDiff !== 0) {
        return createdAtDiff;
      }

      const leftId = parseExerciseSetId(left.set.id);
      const rightId = parseExerciseSetId(right.set.id);

      if (leftId !== null && rightId !== null && leftId !== rightId) {
        return leftId - rightId;
      }

      if (leftId !== null && rightId === null) {
        return -1;
      }

      if (leftId === null && rightId !== null) {
        return 1;
      }

      return left.index - right.index;
    })
    .map(({ set }) => set);

export const toGuestExerciseSets = (
  sets: ExerciseSet[],
): GuestExerciseSet[] =>
  sets.map((set) => ({
    ...set,
    id: String(set.id),
    exercise_id: String(set.exercise_id),
  }));

export const calculateIsPersonalBest = (
  set: ExerciseSet,
  currentWeight: number | null,
  currentReps: number | null,
  currentDuration: number | null,
  personalBest: PersonalBestData | null,
  pbWeightInCurrentUnit: number | null,
): boolean => {
  if (!personalBest || !set.done) return false;

  const hasActivity =
    (currentWeight !== null && currentWeight > 0) ||
    (currentReps !== null && currentReps > 0) ||
    (currentDuration !== null && currentDuration > 0);

  if (!hasActivity) return false;

  if (currentWeight !== null && pbWeightInCurrentUnit !== null) {
    return (
      currentWeight > pbWeightInCurrentUnit ||
      (Math.abs(currentWeight - pbWeightInCurrentUnit) < 0.001 &&
        currentReps !== null &&
        currentReps > personalBest.reps)
    );
  }

  return false;
};

export const getRpeDescription = (rpe: number | null) => {
  if (rpe === null) return "Slide up for higher effort";
  if (rpe >= 10) return "Max Effort";
  if (rpe >= 9) return "Very Hard";
  if (rpe >= 8) return "Hard";
  if (rpe >= 7) return "Moderate";
  if (rpe >= 6) return "Warm up / Light";
  return "Light effort";
};

export const getRirDescription = (rir: number | null) => {
  if (rir === null) return "Slide up for higher effort";
  if (rir === 0) return "Failure (no reps left)";

  const isHalf = rir % 1 !== 0;
  const count = Math.ceil(rir);

  if (isHalf) {
    return `Maybe ${count} left`;
  }

  return `${count} ${count === 1 ? "rep" : "reps"} left`;
};
