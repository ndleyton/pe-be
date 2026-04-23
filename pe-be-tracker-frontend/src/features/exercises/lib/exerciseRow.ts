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

export const getExerciseClientKey = (
  exercise: Pick<Exercise, "id" | "client_key">,
): string | number => exercise.client_key ?? exercise.id;

export const getExerciseSetClientKey = (set: ExerciseSet): string =>
  set.client_key ?? String(set.id);

const areStringArraysEqual = (
  left: string[] | undefined,
  right: string[] | undefined,
) =>
  left === right
  || (
    Array.isArray(left)
    && Array.isArray(right)
    && left.length === right.length
    && left.every((value, index) => value === right[index])
  );

const areExerciseTypesEquivalent = (
  left: Exercise["exercise_type"],
  right: Exercise["exercise_type"],
) =>
  left.id === right.id
  && left.name === right.name
  && left.description === right.description
  && left.equipment === right.equipment
  && left.instructions === right.instructions
  && left.category === right.category
  && left.created_at === right.created_at
  && left.updated_at === right.updated_at
  && left.usage_count === right.usage_count
  && left.default_intensity_unit === right.default_intensity_unit
  && left.times_used === right.times_used
  && left.owner_id === right.owner_id
  && left.status === right.status
  && left.review_requested_at === right.review_requested_at
  && left.released_at === right.released_at
  && left.reviewed_by === right.reviewed_by
  && left.review_notes === right.review_notes
  && areStringArraysEqual(left.muscle_groups, right.muscle_groups)
  && areStringArraysEqual(left.images, right.images);

const areExerciseSetsEquivalent = (
  left: ExerciseSet[],
  right: ExerciseSet[],
) =>
  left.length === right.length
  && left.every((leftSet, index) => {
    const rightSet = right[index];
    return (
      leftSet.id === rightSet.id
      && leftSet.reps === rightSet.reps
      && leftSet.duration_seconds === rightSet.duration_seconds
      && leftSet.intensity === rightSet.intensity
      && leftSet.rpe === rightSet.rpe
      && leftSet.rir === rightSet.rir
      && leftSet.intensity_unit_id === rightSet.intensity_unit_id
      && leftSet.exercise_id === rightSet.exercise_id
      && leftSet.rest_time_seconds === rightSet.rest_time_seconds
      && leftSet.done === rightSet.done
      && leftSet.notes === rightSet.notes
      && leftSet.type === rightSet.type
      && leftSet.created_at === rightSet.created_at
      && leftSet.updated_at === rightSet.updated_at
      && leftSet.deleted_at === rightSet.deleted_at
    );
  });

const areExercisesEquivalent = (
  left: Exercise,
  right: Exercise,
  normalizedRightSets: ExerciseSet[],
) =>
  left.id === right.id
  && left.timestamp === right.timestamp
  && left.notes === right.notes
  && left.exercise_type_id === right.exercise_type_id
  && left.workout_id === right.workout_id
  && left.created_at === right.created_at
  && left.updated_at === right.updated_at
  && areExerciseTypesEquivalent(left.exercise_type, right.exercise_type)
  && areExerciseSetsEquivalent(left.exercise_sets, normalizedRightSets);

export const normalizeExerciseClientKeys = (
  exercises: Exercise[],
  previousExercises: Exercise[] = [],
): Exercise[] => {
  const previousExercisesById = new Map<string, Exercise>();

  previousExercises.forEach((exercise) => {
    previousExercisesById.set(String(exercise.id), exercise);
  });

  return exercises.map((exercise) => {
    const previousExercise = previousExercisesById.get(String(exercise.id));
    const normalizedExercise = {
      ...exercise,
      client_key: exercise.client_key
        ?? previousExercise?.client_key
        ?? String(exercise.id),
      exercise_sets: normalizeExerciseSetClientKeys(
        exercise.exercise_sets ?? [],
        previousExercise?.exercise_sets,
      ),
    };

    if (
      previousExercise
      && areExercisesEquivalent(
        previousExercise,
        normalizedExercise,
        normalizedExercise.exercise_sets,
      )
    ) {
      return previousExercise;
    }

    return normalizedExercise;
  });
};

export const normalizeExerciseSetClientKeys = (
  sets: ExerciseSet[] | undefined,
  previousSets: ExerciseSet[] = [],
): ExerciseSet[] => {
  const previousSetsById = new Map<string, ExerciseSet>();

  previousSets.forEach((set) => {
    previousSetsById.set(String(set.id), set);
  });

  return (sets ?? []).map((set) => {
    const previousSet = previousSetsById.get(String(set.id));
    const normalizedSet = {
      ...set,
      client_key: set.client_key ?? previousSet?.client_key ?? String(set.id),
    };

    if (
      previousSet
      && previousSet.id === normalizedSet.id
      && previousSet.reps === normalizedSet.reps
      && previousSet.duration_seconds === normalizedSet.duration_seconds
      && previousSet.intensity === normalizedSet.intensity
      && previousSet.rpe === normalizedSet.rpe
      && previousSet.rir === normalizedSet.rir
      && previousSet.intensity_unit_id === normalizedSet.intensity_unit_id
      && previousSet.exercise_id === normalizedSet.exercise_id
      && previousSet.rest_time_seconds === normalizedSet.rest_time_seconds
      && previousSet.done === normalizedSet.done
      && previousSet.notes === normalizedSet.notes
      && previousSet.type === normalizedSet.type
      && previousSet.created_at === normalizedSet.created_at
      && previousSet.updated_at === normalizedSet.updated_at
      && previousSet.deleted_at === normalizedSet.deleted_at
    ) {
      return previousSet;
    }

    return normalizedSet;
  });
};

export const buildIntensityInputs = (
  sets: ExerciseSet[],
  displayUnitId?: number,
): Record<string, string> =>
  sets.reduce<Record<string, string>>((acc, set) => {
    acc[getExerciseSetClientKey(set)] = formatIntensityInputValue(
      convertIntensityValue(set.intensity, set.intensity_unit_id, displayUnitId) ??
        set.intensity,
    );
    return acc;
  }, {});

export const buildRepsInputs = (sets: ExerciseSet[]): Record<string, string> =>
  sets.reduce<Record<string, string>>((acc, set) => {
    acc[getExerciseSetClientKey(set)] =
      set.reps === null || set.reps === undefined ? "" : String(set.reps);
    return acc;
  }, {});

export const buildDurationInputs = (
  sets: ExerciseSet[],
): Record<string, string> =>
  sets.reduce<Record<string, string>>((acc, set) => {
    acc[getExerciseSetClientKey(set)] = formatDurationInputValue(set.duration_seconds);
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

export const isNewPersonalBest = (
  currentWeight: number,
  currentReps: number,
  currentRir: number | null | undefined,
  pbWeight: number,
  pbReps: number,
  pbRir: number | null | undefined,
): boolean => {
  // We use a small epsilon (0.001) for weight comparisons in the frontend to handle
  // floating point noise from IEEE 754 precision and unit conversions (e.g., KG to LBS).
  // This ensures the UX remains responsive even if there is tiny binary noise.
  if (currentWeight > pbWeight + 0.001) {
    return true;
  }

  if (Math.abs(currentWeight - pbWeight) < 0.001) {
    if (currentReps > pbReps) {
      return true;
    }

    if (
      currentReps === pbReps &&
      currentRir != null &&
      (pbRir == null || currentRir > pbRir)
    ) {
      return true;
    }
  }

  return false;
};

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
    return isNewPersonalBest(
      currentWeight,
      currentReps ?? 0,
      set.rir,
      pbWeightInCurrentUnit,
      personalBest.reps,
      personalBest.rir,
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
  if (rir >= 4) return "4+ reps left";

  const isHalf = rir % 1 !== 0;
  const count = Math.ceil(rir);

  if (isHalf) {
    return `Maybe ${count} left`;
  }

  return `${count} ${count === 1 ? "rep" : "reps"} left`;
};
