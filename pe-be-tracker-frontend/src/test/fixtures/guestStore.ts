import type {
  GuestData,
  GuestExercise,
  GuestExerciseSet,
  GuestExerciseType,
  GuestWorkout,
  GuestWorkoutType,
} from "@/stores/useGuestStore";

const DEFAULT_TIMESTAMP = "2024-01-01T10:00:00Z";
const DEFAULT_UPDATED_AT = "2024-01-01T10:00:00Z";

let guestFixtureId = 1;

const nextId = (prefix: string) => `${prefix}-${guestFixtureId++}`;

type GuestWorkoutInput = Omit<GuestWorkout, "id" | "created_at" | "updated_at">;
type GuestExerciseInput = Omit<
  GuestExercise,
  "id" | "created_at" | "updated_at" | "exercise_sets"
>;
type GuestExerciseSetInput = Omit<
  GuestExerciseSet,
  "id" | "created_at" | "updated_at"
>;
type GuestStoreLike = {
  workouts: GuestWorkout[];
  workoutTypes: GuestWorkoutType[];
  exerciseTypes: GuestExerciseType[];
  addWorkout: (workout: GuestWorkoutInput) => string;
  addExercise: (exercise: GuestExerciseInput) => string;
  addExerciseSet: (exerciseSet: GuestExerciseSetInput) => string;
};

export const makeGuestWorkoutType = (
  overrides: Partial<GuestWorkoutType> = {},
): GuestWorkoutType => ({
  id: nextId("guest-workout-type"),
  name: "Strength Training",
  description: "Traditional strength training",
  ...overrides,
});

export const makeGuestExerciseType = (
  overrides: Partial<GuestExerciseType> = {},
): GuestExerciseType => ({
  id: nextId("guest-exercise-type"),
  name: "Push-ups",
  description: "Upper body exercise",
  default_intensity_unit: 1,
  times_used: 1,
  ...overrides,
});

export const makeGuestSet = (
  overrides: Partial<GuestExerciseSet> = {},
): GuestExerciseSet => ({
  id: nextId("guest-set"),
  reps: 10,
  intensity: 50,
  intensity_unit_id: 1,
  exercise_id: nextId("guest-exercise"),
  rest_time_seconds: 60,
  done: false,
  created_at: DEFAULT_TIMESTAMP,
  updated_at: DEFAULT_UPDATED_AT,
  ...overrides,
});

export const makeGuestExerciseSet = makeGuestSet;

export const makeGuestExercise = (
  overrides: Partial<GuestExercise> = {},
): GuestExercise => {
  const exerciseType = overrides.exercise_type ?? makeGuestExerciseType();
  const exerciseTypeId = overrides.exercise_type_id ?? exerciseType.id;
  const exercise = {
    id: nextId("guest-exercise"),
    timestamp: DEFAULT_TIMESTAMP,
    notes: null,
    workout_id: nextId("guest-workout"),
    created_at: DEFAULT_TIMESTAMP,
    updated_at: DEFAULT_UPDATED_AT,
    exercise_sets: [],
    ...overrides,
  };

  return {
    ...exercise,
    exercise_type: exerciseType,
    exercise_type_id: exerciseTypeId,
  };
};

export const makeGuestWorkout = (
  overrides: Partial<GuestWorkout> = {},
): GuestWorkout => {
  const workoutType = overrides.workout_type ?? makeGuestWorkoutType();
  const workoutTypeId = overrides.workout_type_id ?? workoutType.id;
  const workout = {
    id: nextId("guest-workout"),
    name: "Test Workout",
    notes: null,
    start_time: DEFAULT_TIMESTAMP,
    end_time: null,
    exercises: [],
    created_at: DEFAULT_TIMESTAMP,
    updated_at: DEFAULT_UPDATED_AT,
    ...overrides,
  };

  return {
    ...workout,
    workout_type: workoutType,
    workout_type_id: workoutTypeId,
  };
};

export const makeGuestData = (
  overrides: Partial<GuestData> = {},
): GuestData => ({
  workouts: [],
  exerciseTypes: [],
  workoutTypes: [],
  routines: [],
  ...overrides,
});

export const makeGuestWorkoutInput = (
  store: GuestStoreLike,
  overrides: Partial<GuestWorkoutInput> = {},
): GuestWorkoutInput => {
  const workoutType = overrides.workout_type ?? store.workoutTypes[0];
  const workoutTypeId = overrides.workout_type_id ?? workoutType.id;
  const workout = {
    name: "Test Workout",
    notes: null,
    start_time: DEFAULT_TIMESTAMP,
    end_time: null,
    exercises: [],
    ...overrides,
  };

  return {
    ...workout,
    workout_type: workoutType,
    workout_type_id: workoutTypeId,
  };
};

export const makeGuestExerciseInput = (
  store: GuestStoreLike,
  workoutId: string,
  overrides: Partial<GuestExerciseInput> = {},
): GuestExerciseInput => {
  const exerciseType = overrides.exercise_type ?? store.exerciseTypes[0];
  const exerciseTypeId = overrides.exercise_type_id ?? exerciseType.id;
  const exercise = {
    workout_id: workoutId,
    notes: null,
    timestamp: DEFAULT_TIMESTAMP,
    ...overrides,
  };

  return {
    ...exercise,
    exercise_type: exerciseType,
    exercise_type_id: exerciseTypeId,
  };
};

export const makeGuestSetInput = (
  exerciseId: string,
  overrides: Partial<GuestExerciseSetInput> = {},
): GuestExerciseSetInput => ({
  exercise_id: exerciseId,
  reps: 10,
  intensity: 50,
  intensity_unit_id: 2,
  rest_time_seconds: 60,
  done: false,
  ...overrides,
});

export const addGuestWorkout = (
  store: GuestStoreLike,
  overrides: Partial<GuestWorkoutInput> = {},
) => store.addWorkout(makeGuestWorkoutInput(store, overrides));

export const addGuestExercise = (
  store: GuestStoreLike,
  workoutId: string,
  overrides: Partial<GuestExerciseInput> = {},
) => store.addExercise(makeGuestExerciseInput(store, workoutId, overrides));

export const addGuestSet = (
  store: GuestStoreLike,
  exerciseId: string,
  overrides: Partial<GuestExerciseSetInput> = {},
) => store.addExerciseSet(makeGuestSetInput(exerciseId, overrides));

export const getGuestWorkout = (store: GuestStoreLike, workoutId: string) =>
  store.workouts.find((workout) => workout.id === workoutId)!;

export const getGuestExercise = (workout: GuestWorkout, exerciseId: string) =>
  workout.exercises.find((exercise) => exercise.id === exerciseId)!;

export const getGuestSet = (exercise: GuestExercise, setId: string) =>
  exercise.exercise_sets.find((set) => set.id === setId)!;
