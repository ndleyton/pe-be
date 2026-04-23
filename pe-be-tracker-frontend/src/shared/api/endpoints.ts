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
  exerciseTypeStats: (exerciseTypeId: string | number) =>
    `/exercises/exercise-types/${exerciseTypeId}/stats`,

  // Exercise Types (nested under exercises)
  exerciseTypes: "/exercises/exercise-types/",
  exerciseTypeById: (id: string | number) => `/exercises/exercise-types/${id}`,
  similarExerciseTypes: (id: string | number) =>
    `/exercises/exercise-types/${id}/similar`,
  requestExerciseTypeEvaluation: (id: string | number) =>
    `/exercises/exercise-types/${id}/request-evaluation`,
  muscles: "/exercises/muscles/",
  muscleGroups: "/exercises/muscle-groups/",

  // Intensity Units (nested under exercises)
  intensityUnits: "/exercises/intensity-units/",
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
  workoutRecap: (id: string | number) => `/workouts/${id}/recap`,
  myWorkouts: "/workouts/mine",

  // Workout Types (nested under workouts)
  workoutTypes: "/workouts/workout-types/",
  workoutTypeById: (id: string | number) => `/workouts/workout-types/${id}`,

  // Auth endpoints
  auth: {
    login: "/auth/login",
    logout: "/auth/logout",
    register: "/auth/register",
    session: "/auth/session",
    googleAuthorize: "/auth/google/authorize",
  },

  admin: {
    exerciseTypeReviewQueue: "/admin/exercise-types/review-queue",
    releaseExerciseType: (id: string | number) =>
      `/admin/exercise-types/${id}/release`,
    exerciseTypeReferenceImageOptions: (id: string | number) =>
      `/admin/exercise-types/${id}/reference-image-options`,
    generateExerciseTypeReferenceImageOptions: (id: string | number) =>
      `/admin/exercise-types/${id}/reference-image-options/generate`,
    applyExerciseTypeReferenceImageOption: (id: string | number) =>
      `/admin/exercise-types/${id}/reference-image-options/apply`,
  },

  // Add exercise to current workout (or create workout if necessary)
  addExerciseToCurrentWorkout: "/workouts/add-exercise",

  // Routine endpoints backed by the legacy `recipes` table
  routines: "/routines/",
  routinesSummary: "/routines/summary",
  routineById: (id: string | number) => `/routines/${id}`,
  startWorkoutFromRoutine: (id: string | number) => `/routines/${id}/start`,

  // Chat endpoints
  chat: "/chat",
  chatConversationById: (id: string | number) => `/chat/conversations/${id}`,
  chatAttachments: "/chat/attachments",
  chatAttachmentById: (id: string | number) => `/chat/attachments/${id}`,
  // Bulk sync
  sync: "/sync/",
} as const;

// Type helpers for endpoints
export type EndpointKey = keyof typeof endpoints;
