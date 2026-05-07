import type {
  ExerciseTemplate,
  Routine,
  RoutineProgramSummary,
  RoutineSummary,
  SetTemplate,
} from "@/features/routines/types";

const DEFAULT_TIMESTAMP = "2024-01-01T10:00:00Z";

let routineFixtureId = 1;

const nextId = () => routineFixtureId++;

export const makeRoutineSetTemplate = (
  overrides: Partial<SetTemplate> = {},
): SetTemplate => ({
  id: nextId(),
  reps: 10,
  duration_seconds: null,
  intensity: 50,
  intensity_unit_id: 1,
  created_at: DEFAULT_TIMESTAMP,
  updated_at: DEFAULT_TIMESTAMP,
  intensity_unit: {
    id: 1,
    name: "Kilograms",
    abbreviation: "kg",
  },
  ...overrides,
});

export const makeRoutineExerciseTemplate = (
  overrides: Partial<ExerciseTemplate> = {},
): ExerciseTemplate => ({
  id: nextId(),
  exercise_type_id: 1,
  created_at: DEFAULT_TIMESTAMP,
  updated_at: DEFAULT_TIMESTAMP,
  exercise_type: {
    id: 1,
    name: "Push-ups",
    description: "Classic bodyweight exercise",
    default_intensity_unit: 1,
    times_used: 10,
  },
  set_templates: [makeRoutineSetTemplate()],
  ...overrides,
});

export const makeRoutine = (
  overrides: Partial<Routine> = {},
): Routine => ({
  id: nextId(),
  name: "Test Routine",
  description: "A test routine",
  workout_type_id: 1,
  creator_id: 1,
  visibility: "private",
  is_readonly: false,
  created_at: DEFAULT_TIMESTAMP,
  updated_at: DEFAULT_TIMESTAMP,
  times_used: 0,
  exercise_templates: [makeRoutineExerciseTemplate()],
  ...overrides,
});

export const makeRoutineSummary = (
  overrides: Partial<RoutineSummary> = {},
): RoutineSummary => {
  const id = overrides.id ?? nextId();
  return {
    id,
    name: "Test Routine",
    description: "A test routine",
    workout_type_id: 1,
    creator_id: 1,
    visibility: "private",
    is_readonly: false,
    created_at: DEFAULT_TIMESTAMP,
    updated_at: DEFAULT_TIMESTAMP,
    times_used: 0,
    exercise_count: 3,
    set_count: 9,
    exercise_names_preview: ["Push-ups", "Rows", "Squats"],
    ...overrides,
  };
};

export const makeRoutineProgramSummary = (
  overrides: Partial<RoutineProgramSummary> = {},
): RoutineProgramSummary => {
  const id = overrides.id ?? nextId();

  return {
    id,
    name: "Test Program",
    description: "A test program",
    creator_id: 1,
    visibility: "public",
    author: null,
    category: null,
    source_label: null,
    is_readonly: false,
    times_used: 0,
    day_count: 4,
    routine_count: 4,
    exercise_count: 16,
    set_count: 48,
    day_labels_preview: ["Day 1", "Day 2", "Day 3", "Day 4"],
    created_at: DEFAULT_TIMESTAMP,
    updated_at: DEFAULT_TIMESTAMP,
    ...overrides,
  };
};
