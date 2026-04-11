/**
 * Navigation key constants used for persistence and routing
 * These should match the 'key' values in navItems configuration
 */
export const NAV_KEYS = {
  WORKOUTS: "workouts",
  ROUTINES: "routines",
  EXERCISES: "exercises",
  PROFILE: "profile",
  CHAT: "chat",
} as const;

/**
 * Type for navigation keys to ensure type safety
 */
export type NavKey = (typeof NAV_KEYS)[keyof typeof NAV_KEYS];

/**
 * Navigation paths constants
 */
export const NAV_PATHS = {
  LOGIN: "/login",
  WORKOUTS: "/workouts",
  ROUTINES: "/routines",
  EXERCISES: "/exercise-types",
  PROFILE: "/profile",
  CHAT: "/chat",
} as const;

/**
 * Type for navigation paths to ensure type safety
 */
export type NavPath = (typeof NAV_PATHS)[keyof typeof NAV_PATHS];
