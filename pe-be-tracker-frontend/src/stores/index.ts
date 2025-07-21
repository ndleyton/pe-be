// Export all stores from a single entry point
export { useAuthStore, type User } from './auth';
export { useGuestStore, type GuestWorkout, type GuestExercise, type GuestRecipe } from './guest';
export { useUIStore } from './ui';

// Initialize auth store on app startup
export const initializeStores = async () => {
  const { useAuthStore } = await import('./auth');
  const { initialize } = useAuthStore.getState();
  await initialize();
};