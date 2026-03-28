import type {
  Exercise,
  ExerciseSet,
  IntensityUnit,
} from "@/features/exercises/api";
import type { GuestExerciseSet } from "@/stores";
import { formatDecimal } from "@/utils/format";

export interface GuestIntensityUnit {
  id: number;
  name: string;
  abbreviation: string;
}

export interface ExerciseRowProps {
  exercise: Exercise;
  onExerciseUpdate?: (updatedExercise: Exercise) => void;
  onExerciseDelete?: (exerciseId: number | string) => void;
  workoutId?: string;
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
): Record<string, string> =>
  sets.reduce<Record<string, string>>((acc, set) => {
    acc[String(set.id)] = formatIntensityInputValue(set.intensity);
    return acc;
  }, {});

export const buildRepsInputs = (sets: ExerciseSet[]): Record<string, string> =>
  sets.reduce<Record<string, string>>((acc, set) => {
    acc[String(set.id)] =
      set.reps === null || set.reps === undefined ? "" : String(set.reps);
    return acc;
  }, {});

export const toGuestExerciseSets = (
  sets: ExerciseSet[],
): GuestExerciseSet[] =>
  sets.map((set) => ({
    ...set,
    id: String(set.id),
    exercise_id: String(set.exercise_id),
  }));
