/**
 * Type-safe API endpoint definitions
 * Centralizes all API routes to prevent drift and enable easy updates
 */

const API_VERSION = 'v1';

export const endpoints = {
  // Exercise endpoints
  exercises: '/exercises',
  exerciseById: (id: string | number) => `/exercises/${id}`,
  exercisesInWorkout: (workoutId: string | number) => `/workouts/${workoutId}/exercises`,
  
  // Exercise Types (nested under exercises)
  exerciseTypes: '/exercises/exercise-types',
  exerciseTypeById: (id: string | number) => `/exercises/exercise-types/${id}`,
  
  // Intensity Units (nested under exercises)
  intensityUnits: '/exercises/intensity-units',
  intensityUnitById: (id: string | number) => `/exercises/intensity-units/${id}`,
  
  // Exercise Sets
  exerciseSets: '/exercise-sets',
  exerciseSetById: (id: string | number) => `/exercise-sets/${id}`,
  exerciseSetsByExercise: (exerciseId: string | number) => `/exercise-sets/exercise/${exerciseId}`,
  
  // Workout endpoints
  workouts: '/workouts',
  workoutById: (id: string | number) => `/workouts/${id}`,
  
  // Workout Types (nested under workouts)
  workoutTypes: '/workouts/workout-types',
  workoutTypeById: (id: string | number) => `/workouts/workout-types/${id}`,
  
  // Auth endpoints
  auth: {
    login: '/auth/login',
    logout: '/auth/logout',
    register: '/auth/register',
    me: '/auth/me',
  },
} as const;

/**
 * Legacy endpoints - DEPRECATED
 * These will be removed in the future, use nested endpoints above
 */
export const legacyEndpoints = {
  exerciseTypes: '/exercise-types',
  intensityUnits: '/intensity-units', 
  workoutTypes: '/workout-types',
} as const;

/**
 * Console warning for legacy endpoint usage
 * @param legacyPath - The legacy path being used
 * @param newPath - The new nested path that should be used
 */
export const warnLegacyEndpoint = (legacyPath: string, newPath: string) => {
  if (process.env.NODE_ENV !== 'production') {
    console.warn(
      `[API] Legacy endpoint detected: ${legacyPath}. Please migrate to: ${newPath}. Legacy endpoints will be removed in a future release.`
    );
  }
};

// Type helpers for endpoints
export type EndpointKey = keyof typeof endpoints;
export type LegacyEndpointKey = keyof typeof legacyEndpoints;