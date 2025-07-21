import { useShallow } from 'zustand/react/shallow';
import { useGuestStore, useAuthStore } from './index';

// Example: Computing exercise type names
// Without useShallow, this would re-render even if the names array is the same
export const useExerciseTypeNames = () => {
  return useGuestStore(
    useShallow((state) => state.exerciseTypes.map(type => type.name))
  );
};

// Example: Computing workout stats
// This creates a new object every time, but useShallow prevents unnecessary re-renders
export const useWorkoutStats = () => {
  return useGuestStore(
    useShallow((state) => {
      const completedWorkouts = state.workouts.filter(w => w.end_time);
      return {
        total: state.workouts.length,
        completed: completedWorkouts.length,
        pending: state.workouts.length - completedWorkouts.length,
      };
    })
  );
};

// Example: Multiple auth values at once
export const useAuthState = () => {
  return useAuthStore(
    useShallow((state) => ({
      user: state.user,
      loading: state.loading,
      isAuthenticated: !!state.user,
    }))
  );
};

// Example: Recent workouts (computed array)
export const useRecentWorkouts = (limit = 5) => {
  return useGuestStore(
    useShallow((state) => 
      state.workouts
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, limit)
    )
  );
};