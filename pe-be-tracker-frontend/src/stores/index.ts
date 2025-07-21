// Export all stores from a single entry point
export { useAuthStore, selectIsAuthenticated, selectUser, selectLoading, type User } from './auth';
export { 
  useGuestStore, 
  selectWorkouts,
  selectExerciseTypes,
  selectWorkoutTypes,
  selectRecipes,
  type GuestWorkout, 
  type GuestExercise, 
  type GuestRecipe,
  type GuestExerciseSet,
  type GuestExerciseType,
  type GuestWorkoutType,
  type GuestIntensityUnit
} from './guest';
export { useUIStore } from './ui';

// Initialize auth store on app startup
export const initializeStores = async () => {
  const { useAuthStore } = await import('./auth');
  const { initialize } = useAuthStore.getState();
  await initialize();
};