import type {
  Exercise,
  ExerciseSet,
} from "@/features/exercises/api";
import type { ExerciseType } from "@/features/exercises/types";

let exerciseTypeFixtureId = 1;
let exerciseSetFixtureId = 1;
let exerciseFixtureId = 1;

const nextExerciseTypeId = () => exerciseTypeFixtureId++;
const nextExerciseSetId = () => exerciseSetFixtureId++;
const nextExerciseId = () => exerciseFixtureId++;

type ExerciseTypeOverrides =
  | Partial<ExerciseType>
  | ((index: number) => Partial<ExerciseType>);

export const makeExerciseType = (
  overrides: Partial<ExerciseType> = {},
): ExerciseType => ({
  id: nextExerciseTypeId(),
  name: "Push-ups",
  description: "Classic bodyweight exercise",
  muscle_groups: ["chest", "triceps"],
  equipment: null,
  instructions: null,
  category: null,
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
  usage_count: 10,
  default_intensity_unit: 1,
  times_used: 10,
  ...overrides,
});

export const makeExerciseTypes = (
  count: number,
  overrides: ExerciseTypeOverrides = {},
): ExerciseType[] =>
  Array.from({ length: count }, (_, index) =>
    makeExerciseType(
      typeof overrides === "function" ? overrides(index) : overrides,
    ),
  );

export const makePaginatedExerciseTypes = (
  exerciseTypes: ExerciseType[],
  next_cursor: number | null = null,
) => ({
  data: exerciseTypes,
  next_cursor,
});

export const makeExerciseSet = (
  overrides: Partial<ExerciseSet> = {},
): ExerciseSet => ({
  id: nextExerciseSetId(),
  reps: 10,
  intensity: 50,
  intensity_unit_id: 1,
  exercise_id: 1,
  rest_time_seconds: 60,
  done: false,
  notes: null,
  type: "working",
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
  ...overrides,
});

export const makeExercise = (
  overrides: Partial<Exercise> = {},
): Exercise => {
  const exerciseType =
    overrides.exercise_type ??
    makeExerciseType({
      id:
        typeof overrides.exercise_type_id === "number"
          ? overrides.exercise_type_id
          : nextExerciseTypeId(),
    });

  return {
    id: nextExerciseId(),
    timestamp: "2024-01-01T10:00:00Z",
    notes: null,
    exercise_type_id: exerciseType.id,
    workout_id: 1,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    exercise_type: exerciseType,
    exercise_sets: [],
    ...overrides,
  };
};
