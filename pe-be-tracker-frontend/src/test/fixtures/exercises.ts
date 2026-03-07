import type { ExerciseType } from "@/features/exercises/types";

let exerciseTypeFixtureId = 1;

const nextExerciseTypeId = () => exerciseTypeFixtureId++;

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
