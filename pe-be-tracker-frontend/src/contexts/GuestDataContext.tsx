import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { syncGuestDataToServer, showSyncSuccessToast, showSyncErrorToast } from '@/utils/syncGuestData';
import { generateSecureId, getCurrentUTCTimestamp } from '@/utils/date';

// Guest data interfaces that mirror the server-side structures but with local IDs
export interface GuestExerciseType {
  id: string; // Local UUID for guest data
  name: string;
  description: string | null;
  default_intensity_unit: number;
  times_used: number;
}

export interface GuestIntensityUnit {
  id: number; // Keep same as server since these are reference data
  name: string;
  abbreviation: string;
}

export interface GuestExerciseSet {
  id: string; // Local UUID for guest data
  reps: number | null;
  intensity: number | null;
  intensity_unit_id: number;
  exercise_id: string; // References local guest exercise ID
  rest_time_seconds: number | null;
  done: boolean;
  created_at: string;
  updated_at: string;
}

export interface GuestExercise {
  id: string; // Local UUID for guest data
  timestamp: string | null;
  notes: string | null;
  exercise_type_id: string; // References local guest exercise type ID
  workout_id: string; // References local guest workout ID
  created_at: string;
  updated_at: string;
  exercise_type: GuestExerciseType;
  exercise_sets: GuestExerciseSet[];
}

export interface GuestWorkoutType {
  id: string; // Local UUID for guest data
  name: string;
  description: string | null;
}

export interface GuestWorkout {
  id: string; // Local UUID for guest data
  name: string | null;
  notes: string | null;
  start_time: string;
  end_time: string | null;
  workout_type_id: string; // References local guest workout type ID
  workout_type: GuestWorkoutType;
  exercises: GuestExercise[];
  created_at: string;
  updated_at: string;
}

export interface GuestRecipeSet {
  id: string;
  reps: number | null;
  intensity: number | null;
  intensity_unit_id: number;
  rest_time_seconds: number | null;
}

export interface GuestRecipeExercise {
  id: string;
  exercise_type_id: string;
  exercise_type: GuestExerciseType;
  sets: GuestRecipeSet[];
  notes: string | null;
}

export interface GuestRecipe {
  id: string;
  name: string;
  description?: string;
  exercises: GuestRecipeExercise[];
  created_at: string;
  updated_at: string;
}

export interface GuestData {
  workouts: GuestWorkout[];
  exerciseTypes: GuestExerciseType[];
  workoutTypes: GuestWorkoutType[];
  recipes: GuestRecipe[];
}

// Action types
export interface GuestDataActions {
  // Workout actions
  addWorkout: (workout: Omit<GuestWorkout, 'id' | 'created_at' | 'updated_at' | 'exercises'>) => string;
  updateWorkout: (id: string, updates: Partial<GuestWorkout>) => void;
  deleteWorkout: (id: string) => void;
  
  // Exercise actions
  addExercise: (exercise: Omit<GuestExercise, 'id' | 'created_at' | 'updated_at' | 'exercise_sets'>) => string;
  updateExercise: (id: string, updates: Partial<GuestExercise>) => void;
  deleteExercise: (id: string) => void;
  
  // Exercise set actions
  addExerciseSet: (exerciseSet: Omit<GuestExerciseSet, 'id' | 'created_at' | 'updated_at'>) => string;
  updateExerciseSet: (id: string, updates: Partial<GuestExerciseSet>) => void;
  deleteExerciseSet: (id: string) => void;
  
  // Exercise type actions
  addExerciseType: (exerciseType: Omit<GuestExerciseType, 'id' | 'times_used'>) => string;
  updateExerciseType: (id: string, updates: Partial<GuestExerciseType>) => void;
  
  // Workout type actions
  addWorkoutType: (workoutType: Omit<GuestWorkoutType, 'id'>) => string;
  updateWorkoutType: (id: string, updates: Partial<GuestWorkoutType>) => void;
  
  // Recipe actions
  addRecipe: (recipe: Omit<GuestRecipe, 'id' | 'created_at' | 'updated_at'>) => string;
  deleteRecipe: (id: string) => void;
  createRecipeFromWorkout: (workoutName: string, exercises: GuestExercise[]) => string;
  createExercisesFromRecipe: (recipe: GuestRecipe, workoutId: string) => string[];
  
  // Utility actions
  clear: () => void;
  getWorkout: (id: string) => GuestWorkout | undefined;
  getExercise: (id: string) => GuestExercise | undefined;
}

interface GuestDataContextType {
  data: GuestData;
  actions: GuestDataActions;
  isAuthenticated: () => boolean;
}

const GuestDataContext = createContext<GuestDataContextType | undefined>(undefined);

const GUEST_DATA_KEY = 'pe-guest-data';

// Utility functions (use secure implementations from date utils)
const generateId = generateSecureId;
const getCurrentTimestamp = getCurrentUTCTimestamp;

// Initial data with default exercise types and workout types
const getInitialGuestData = (): GuestData => ({
  workouts: [],
  exerciseTypes: [
    {
      id: generateId(),
      name: 'Push-ups',
      description: 'Upper body bodyweight exercise',
      default_intensity_unit: 1, // bodyweight
      times_used: 0,
    },
    {
      id: generateId(),
      name: 'Squats',
      description: 'Lower body bodyweight exercise',
      default_intensity_unit: 1, // bodyweight
      times_used: 0,
    },
    {
      id: generateId(),
      name: 'Bench Press',
      description: 'Upper body strength exercise',
      default_intensity_unit: 2, // kg
      times_used: 0,
    },
    {
      id: generateId(),
      name: 'Deadlift',
      description: 'Full body strength exercise',
      default_intensity_unit: 2, // kg
      times_used: 0,
    },
  ],
  workoutTypes: [
    {
      id: generateId(),
      name: 'Strength Training',
      description: 'Traditional weightlifting session',
    },
    {
      id: generateId(),
      name: 'Cardio',
      description: 'Cardiovascular exercise session',
    },
    {
      id: generateId(),
      name: 'Bodyweight',
      description: 'Exercises using your own body weight',
    },
  ],
  recipes: [],
});

export const useGuestData = () => {
  const context = useContext(GuestDataContext);
  if (context === undefined) {
    throw new Error('useGuestData must be used within a GuestDataProvider');
  }
  return context;
};

interface GuestDataProviderProps {
  children: ReactNode;
}

// Migration function to ensure recipes property exists
const migrateGuestData = (data: any): GuestData => {
  const migrated = { ...data };
  
  // Add recipes array if it doesn't exist
  if (!migrated.recipes) {
    migrated.recipes = [];
  }
  
  return migrated as GuestData;
};

export const GuestDataProvider: React.FC<GuestDataProviderProps> = ({ children }) => {
  const [data, setData] = useState<GuestData>(() => {
    try {
      const stored = localStorage.getItem(GUEST_DATA_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return migrateGuestData(parsed);
      }
      return getInitialGuestData();
    } catch {
      return getInitialGuestData();
    }
  });

  // Save to localStorage whenever data changes
  useEffect(() => {
    try {
      localStorage.setItem(GUEST_DATA_KEY, JSON.stringify(data));
    } catch (error) {
      console.warn('Failed to save guest data to localStorage:', error);
    }
  }, [data]);

  const { isAuthenticated: authIsAuthenticated, user } = useAuth();

  const isAuthenticated = (): boolean => authIsAuthenticated();

  // Automatically sync guest data once after the user logs in
  const hasAttemptedSync = React.useRef(false);

  React.useEffect(() => {
    if (user && data.workouts.length > 0 && !hasAttemptedSync.current) {
      hasAttemptedSync.current = true;
      (async () => {
        const result = await syncGuestDataToServer(data, actions.clear);
        if (result.success) {
          showSyncSuccessToast(result);
        } else {
          showSyncErrorToast(result.error ?? 'Unknown error');
        }
      })();
    }
  }, [user, data]);

  const actions: GuestDataActions = {
    // Workout actions
    addWorkout: (workout) => {
      const id = generateId();
      const now = getCurrentTimestamp();
      const newWorkout: GuestWorkout = {
        ...workout,
        id,
        exercises: [],
        created_at: now,
        updated_at: now,
      };
      setData(prev => ({
        ...prev,
        workouts: [...prev.workouts, newWorkout],
      }));
      return id;
    },

    updateWorkout: (id, updates) => {
      setData(prev => ({
        ...prev,
        workouts: prev.workouts.map(workout =>
          workout.id === id
            ? { ...workout, ...updates, updated_at: getCurrentTimestamp() }
            : workout
        ),
      }));
    },

    deleteWorkout: (id) => {
      setData(prev => ({
        ...prev,
        workouts: prev.workouts.filter(workout => workout.id !== id),
      }));
    },

    // Exercise actions
    addExercise: (exercise) => {
      const id = generateId();
      const now = getCurrentTimestamp();
      const newExercise: GuestExercise = {
        ...exercise,
        id,
        exercise_sets: [],
        created_at: now,
        updated_at: now,
      };

      setData(prev => ({
        ...prev,
        workouts: prev.workouts.map(workout =>
          workout.id === exercise.workout_id
            ? {
                ...workout,
                exercises: [...workout.exercises, newExercise],
                updated_at: now,
              }
            : workout
        ),
      }));
      return id;
    },

    updateExercise: (id, updates) => {
      const now = getCurrentTimestamp();
      setData(prev => ({
        ...prev,
        workouts: prev.workouts.map(workout => ({
          ...workout,
          exercises: workout.exercises.map(exercise =>
            exercise.id === id
              ? { ...exercise, ...updates, updated_at: now }
              : exercise
          ),
        })),
      }));
    },

    deleteExercise: (id) => {
      setData(prev => ({
        ...prev,
        workouts: prev.workouts.map(workout => ({
          ...workout,
          exercises: workout.exercises.filter(exercise => exercise.id !== id),
        })),
      }));
    },

    // Exercise set actions
    addExerciseSet: (exerciseSet) => {
      const id = generateId();
      const now = getCurrentTimestamp();
      const newExerciseSet: GuestExerciseSet = {
        ...exerciseSet,
        id,
        created_at: now,
        updated_at: now,
      };

      setData(prev => ({
        ...prev,
        workouts: prev.workouts.map(workout => ({
          ...workout,
          exercises: workout.exercises.map(exercise =>
            exercise.id === exerciseSet.exercise_id
              ? {
                  ...exercise,
                  exercise_sets: [...exercise.exercise_sets, newExerciseSet],
                  updated_at: now,
                }
              : exercise
          ),
        })),
      }));
      return id;
    },

    updateExerciseSet: (id, updates) => {
      const now = getCurrentTimestamp();
      setData(prev => ({
        ...prev,
        workouts: prev.workouts.map(workout => ({
          ...workout,
          exercises: workout.exercises.map(exercise => ({
            ...exercise,
            exercise_sets: exercise.exercise_sets.map(set =>
              set.id === id
                ? { ...set, ...updates, updated_at: now }
                : set
            ),
          })),
        })),
      }));
    },

    deleteExerciseSet: (id) => {
      setData(prev => ({
        ...prev,
        workouts: prev.workouts.map(workout => ({
          ...workout,
          exercises: workout.exercises.map(exercise => ({
            ...exercise,
            exercise_sets: exercise.exercise_sets.filter(set => set.id !== id),
          })),
        })),
      }));
    },

    // Exercise type actions
    addExerciseType: (exerciseType) => {
      const id = generateId();
      const newExerciseType: GuestExerciseType = {
        ...exerciseType,
        id,
        times_used: 0,
      };
      setData(prev => ({
        ...prev,
        exerciseTypes: [...prev.exerciseTypes, newExerciseType],
      }));
      return id;
    },

    updateExerciseType: (id, updates) => {
      setData(prev => ({
        ...prev,
        exerciseTypes: prev.exerciseTypes.map(type =>
          type.id === id ? { ...type, ...updates } : type
        ),
      }));
    },

    // Workout type actions
    addWorkoutType: (workoutType) => {
      const id = generateId();
      const newWorkoutType: GuestWorkoutType = {
        ...workoutType,
        id,
      };
      setData(prev => ({
        ...prev,
        workoutTypes: [...prev.workoutTypes, newWorkoutType],
      }));
      return id;
    },

    updateWorkoutType: (id, updates) => {
      setData(prev => ({
        ...prev,
        workoutTypes: prev.workoutTypes.map(type =>
          type.id === id ? { ...type, ...updates } : type
        ),
      }));
    },

    // Recipe actions
    addRecipe: (recipe) => {
      const id = generateId();
      const now = getCurrentTimestamp();
      const newRecipe: GuestRecipe = {
        ...recipe,
        id,
        created_at: now,
        updated_at: now,
      };
      setData(prev => ({
        ...prev,
        recipes: [...(prev.recipes || []), newRecipe],
      }));
      return id;
    },

    deleteRecipe: (id) => {
      setData(prev => ({
        ...prev,
        recipes: (prev.recipes || []).filter(recipe => recipe.id !== id),
      }));
    },

    createRecipeFromWorkout: (workoutName, exercises) => {
      const id = generateId();
      const now = getCurrentTimestamp();
      
      const recipeExercises: GuestRecipeExercise[] = exercises.map(exercise => ({
        id: generateId(),
        exercise_type_id: exercise.exercise_type_id,
        exercise_type: exercise.exercise_type,
        sets: exercise.exercise_sets.map(set => ({
          id: generateId(),
          reps: set.reps,
          intensity: set.intensity,
          intensity_unit_id: set.intensity_unit_id,
          rest_time_seconds: set.rest_time_seconds,
        })),
        notes: exercise.notes || null,
      }));

      const newRecipe: GuestRecipe = {
        id,
        name: workoutName || 'My Recipe',
        exercises: recipeExercises,
        created_at: now,
        updated_at: now,
      };

      setData(prev => ({
        ...prev,
        recipes: [...(prev.recipes || []), newRecipe],
      }));
      
      return id;
    },

    createExercisesFromRecipe: (recipe, workoutId) => {
      const exerciseIds: string[] = [];
      
      recipe.exercises.forEach(recipeExercise => {
        // Create exercise from recipe
        const exerciseId = actions.addExercise({
          workout_id: workoutId,
          exercise_type_id: recipeExercise.exercise_type_id,
          exercise_type: recipeExercise.exercise_type,
          notes: recipeExercise.notes,
          timestamp: getCurrentTimestamp(),
        });
        
        exerciseIds.push(exerciseId);
        
        // Create sets from recipe
        recipeExercise.sets.forEach(recipeSet => {
          actions.addExerciseSet({
            exercise_id: exerciseId,
            reps: recipeSet.reps,
            intensity: recipeSet.intensity,
            intensity_unit_id: recipeSet.intensity_unit_id,
            rest_time_seconds: recipeSet.rest_time_seconds,
            done: false,
          });
        });
      });
      
      return exerciseIds;
    },

    // Utility actions
    clear: () => {
      setData(getInitialGuestData());
      try {
        localStorage.removeItem(GUEST_DATA_KEY);
      } catch (error) {
        console.warn('Failed to clear guest data from localStorage:', error);
      }
    },

    getWorkout: (id) => {
      return data.workouts.find(workout => workout.id === id);
    },

    getExercise: (id) => {
      for (const workout of data.workouts) {
        const exercise = workout.exercises.find(ex => ex.id === id);
        if (exercise) return exercise;
      }
      return undefined;
    },
  };

  const contextValue: GuestDataContextType = {
    data,
    actions,
    isAuthenticated,
  };

  return (
    <GuestDataContext.Provider value={contextValue}>
      {children}
    </GuestDataContext.Provider>
  );
};