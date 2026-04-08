import type {
  ExerciseTemplate,
  Routine,
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
  exercise_templates: [makeRoutineExerciseTemplate()],
  ...overrides,
});
