import type {
  Exercise,
  ExerciseSet,
  IntensityUnit,
} from "@/features/exercises/api";
import type { GuestExerciseSet } from "@/stores";
import { formatDecimal } from "@/utils/format";
import {
  convertIntensityValue,
  type GuestIntensityUnit,
} from "@/features/exercises/lib/intensityUnits";

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

export const EXERCISE_SETS_GRID_TEMPLATE = "30px 60px 1fr 40px 32px";

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
