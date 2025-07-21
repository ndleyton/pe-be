import { useGuestStore, useAuthStore } from '@/stores';

/**
 * Compatibility hook for useGuestData that uses Zustand stores
 * Provides the same interface as the old GuestDataContext
 */
export const useGuestData = () => {
  const guestData = useGuestStore((state) => ({
    workouts: state.workouts,
    exerciseTypes: state.exerciseTypes,
    workoutTypes: state.workoutTypes,
    recipes: state.recipes,
  }));

  const guestActions = useGuestStore((state) => ({
    // Workout actions
    addWorkout: state.addWorkout,
    updateWorkout: state.updateWorkout,
    deleteWorkout: state.deleteWorkout,
    getWorkout: state.getWorkout,
    
    // Exercise actions
    addExercise: state.addExercise,
    updateExercise: state.updateExercise,
    deleteExercise: state.deleteExercise,
    getExercise: state.getExercise,
    
    // Exercise set actions
    addExerciseSet: state.addExerciseSet,
    updateExerciseSet: state.updateExerciseSet,
    deleteExerciseSet: state.deleteExerciseSet,
    
    // Exercise type actions
    addExerciseType: state.addExerciseType,
    updateExerciseType: state.updateExerciseType,
    
    // Workout type actions
    addWorkoutType: state.addWorkoutType,
    updateWorkoutType: state.updateWorkoutType,
    
    // Recipe actions
    addRecipe: state.addRecipe,
    deleteRecipe: state.deleteRecipe,
    createRecipeFromWorkout: state.createRecipeFromWorkout,
    createExercisesFromRecipe: state.createExercisesFromRecipe,
    
    // Utility actions
    clear: state.clear,
  }));

  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  return {
    data: guestData,
    actions: guestActions,
    isAuthenticated: () => isAuthenticated,
  };
}; 