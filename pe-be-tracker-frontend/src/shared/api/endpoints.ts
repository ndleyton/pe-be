/**
 * Type-safe API endpoint definitions
 * Centralizes all API routes to prevent drift and enable easy updates
 */

export const endpoints = {
  // Exercise endpoints
  // Use trailing slash to match FastAPI collection route and avoid 307 redirects on POST
  exercises: "/exercises/",
  exerciseById: (id: string | number) => `/exercises/${id}`,
  exercisesInWorkout: (workoutId: string | number) =>
    `/workouts/${workoutId}/exercises`,

  // Exercise Types (nested under exercises)
  exerciseTypes: "/exercises/exercise-types",
  exerciseTypeById: (id: string | number) => `/exercises/exercise-types/${id}`,

  // Intensity Units (nested under exercises)
  intensityUnits: "/exercises/intensity-units",
  intensityUnitById: (id: string | number) =>
    `/exercises/intensity-units/${id}`,

  // Exercise Sets
  exerciseSets: "/exercise-sets/",
  exerciseSetById: (id: string | number) => `/exercise-sets/${id}`,
  exerciseSetsByExercise: (exerciseId: string | number) =>
    `/exercise-sets/exercise/${exerciseId}`,

  // Workout endpoints
  workouts: "/workouts/",
  workoutById: (id: string | number) => `/workouts/${id}`,

  // Workout Types (nested under workouts)
  workoutTypes: "/workouts/workout-types",
  workoutTypeById: (id: string | number) => `/workouts/workout-types/${id}`,

  // Auth endpoints
  auth: {
    login: "/auth/login",
    logout: "/auth/logout",
    register: "/auth/register",
    me: "/auth/me",
  },

  // Add exercise to current workout (or create workout if necessary)
  addExerciseToCurrentWorkout: "/workouts/add-exercise",

  // Routine endpoints (recipes in backend, routines for users)
  routines: "/routines/",
  routineById: (id: string | number) => `/routines/${id}`,
} as const;

// Type helpers for endpoints
export type EndpointKey = keyof typeof endpoints;
