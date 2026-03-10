import type { PaginatedWorkouts, Workout } from "@/features/workouts";

const DEFAULT_START = "2024-01-01T08:00:00Z";
const DEFAULT_END = "2024-01-01T09:00:00Z";

let workoutFixtureId = 1;

const nextWorkoutId = () => workoutFixtureId++;

type WorkoutOverrides =
  | Partial<Workout>
  | ((index: number) => Partial<Workout>);

export const makeWorkout = (overrides: Partial<Workout> = {}): Workout => ({
  id: nextWorkoutId(),
  name: "Morning Workout",
  notes: "Great session",
  start_time: DEFAULT_START,
  end_time: DEFAULT_END,
  workout_type_id: 1,
  created_at: DEFAULT_START,
  updated_at: DEFAULT_END,
  ...overrides,
});

export const makeOngoingWorkout = (
  overrides: Partial<Workout> = {},
): Workout =>
  makeWorkout({
    name: "In Progress Workout",
    end_time: null,
    updated_at: DEFAULT_START,
    ...overrides,
  });

export const makeWorkoutWithStringId = (
  overrides: Partial<Workout> = {},
): Workout =>
  makeWorkout({
    id: `workout-${nextWorkoutId()}`,
    name: "String ID Workout",
    notes: "Test workout",
    ...overrides,
  });

export const makeWorkouts = (
  count: number,
  overrides: WorkoutOverrides = {},
): Workout[] =>
  Array.from({ length: count }, (_, index) =>
    makeWorkout(
      typeof overrides === "function" ? overrides(index) : overrides,
    ),
  );

export const makePaginatedWorkouts = (
  workouts: Workout[],
  next_cursor: number | null = null,
): PaginatedWorkouts => ({
  data: workouts,
  next_cursor,
});
