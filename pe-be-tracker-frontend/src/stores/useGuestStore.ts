import { create } from 'zustand';
import { syncGuestDataToServer, showSyncSuccessToast, showSyncErrorToast } from '@/utils/syncGuestData';
import { generateRandomId, getCurrentUTCTimestamp } from '@/utils/date';
import { useAuthStore } from './useAuthStore';

export interface GuestExerciseType {
  id: string;
  name: string;
  description: string | null;
  default_intensity_unit: number;
  times_used: number;
  equipment?: string | null;
  instructions?: string | null;
  category?: string | null;
  created_at?: string;
  updated_at?: string;
  usage_count?: number;
  muscles?: Array<{ id: number; name: string }>;
  muscle_groups?: string[];
}

export interface GuestIntensityUnit {
  id: number;
  name: string;
  abbreviation: string;
}

export interface GuestExerciseSet {
  id: string;
  reps: number | null;
  intensity: number | null;
  intensity_unit_id: number;
  exercise_id: string;
  rest_time_seconds: number | null;
  done: boolean;
  notes?: string | null;
  type?: string | null;
  created_at: string;
  updated_at: string;
}

export interface GuestExercise {
  id: string;
  timestamp: string | null;
  notes: string | null;
  exercise_type_id: string;
  workout_id: string;
  created_at: string;
  updated_at: string;
  exercise_type: GuestExerciseType;
  exercise_sets: GuestExerciseSet[];
}

export interface GuestWorkoutType {
  id: string;
  name: string;
  description: string | null;
}

export interface GuestWorkout {
  id: string;
  name: string | null;
  notes: string | null;
  start_time: string;
  end_time: string | null;
  workout_type_id: string;
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
  notes?: string | null;
  type?: string | null;
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

interface GuestState extends GuestData {
  hasAttemptedSync: boolean;
}

interface GuestActions {
  addWorkout: (workout: Omit<GuestWorkout, 'id' | 'created_at' | 'updated_at'>) => string;
  updateWorkout: (id: string, updates: Partial<GuestWorkout>) => void;
  deleteWorkout: (id: string) => void;
  
  addExercise: (exercise: Omit<GuestExercise, 'id' | 'created_at' | 'updated_at' | 'exercise_sets'>) => string;
  updateExercise: (id: string, updates: Partial<GuestExercise>) => void;
  deleteExercise: (id: string) => void;
  
  addExerciseSet: (exerciseSet: Omit<GuestExerciseSet, 'id' | 'created_at' | 'updated_at'>) => string;
  updateExerciseSet: (id: string, updates: Partial<GuestExerciseSet>) => void;
  deleteExerciseSet: (id: string) => void;
  
  addExerciseType: (exerciseType: Omit<GuestExerciseType, 'id' | 'times_used'>) => string;
  updateExerciseType: (id: string, updates: Partial<GuestExerciseType>) => void;
  
  addWorkoutType: (workoutType: Omit<GuestWorkoutType, 'id'>) => string;
  updateWorkoutType: (id: string, updates: Partial<GuestWorkoutType>) => void;
  
  // Routine-named actions
  addRoutine: (routine: Omit<GuestRecipe, 'id' | 'created_at' | 'updated_at'>) => string;
  deleteRoutine: (id: string) => void;
  createRoutineFromWorkout: (workoutName: string, exercises: GuestExercise[]) => string;
  createExercisesFromRoutine: (routine: GuestRecipe, workoutId: string) => string[];
  
  clear: () => void;
  getWorkout: (id: string) => GuestWorkout | undefined;
  getExercise: (id: string) => GuestExercise | undefined;
  syncWithServer: () => Promise<void>;
}

type GuestStore = GuestState & GuestActions;

const GUEST_DATA_KEY = 'pe-guest-data';

const getInitialGuestData = (): GuestData => ({
  workouts: [],
  exerciseTypes: [
    {
      id: generateRandomId(),
      name: 'Push-ups',
      description: 'Upper body bodyweight exercise',
      default_intensity_unit: 1,
      times_used: 0,
    },
    {
      id: generateRandomId(),
      name: 'Squats',
      description: 'Lower body bodyweight exercise',
      default_intensity_unit: 1,
      times_used: 0,
    },
    {
      id: generateRandomId(),
      name: 'Bench Press',
      description: 'Upper body strength exercise',
      default_intensity_unit: 2,
      times_used: 0,
    },
    {
      id: generateRandomId(),
      name: 'Deadlift',
      description: 'Full body strength exercise',
      default_intensity_unit: 2,
      times_used: 0,
    },
  ],
  workoutTypes: [
    {
      id: generateRandomId(),
      name: 'Strength Training',
      description: 'Traditional weightlifting session',
    },
    {
      id: generateRandomId(),
      name: 'Cardio',
      description: 'Cardiovascular exercise session',
    },
    {
      id: generateRandomId(),
      name: 'Bodyweight',
      description: 'Exercises using your own body weight',
    },
    {
      id: '8',
      name: 'Other',
      description: 'General workout session',
    },
  ],
  recipes: [],
});

const migrateGuestData = (data: any): GuestData => {
  const migrated = { ...data };
  
  if (!migrated.recipes) {
    migrated.recipes = [];
  }
  
  return migrated as GuestData;
};

const loadGuestData = (): GuestData => {
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
};

const saveGuestData = (data: GuestData) => {
  try {
    localStorage.setItem(GUEST_DATA_KEY, JSON.stringify(data));
  } catch (error) {
    console.warn('Failed to save guest data to localStorage:', error);
  }
};

export const useGuestStore = create<GuestStore>((set, get) => {
  const initialData = loadGuestData();
  
  return {
    ...initialData,
    hasAttemptedSync: false,

    addWorkout: (workout) => {
      const id = generateRandomId();
      const now = getCurrentUTCTimestamp();
      const newWorkout: GuestWorkout = {
        ...workout,
        id,
        created_at: now,
        updated_at: now,
      };
      
      set((state) => {
        const newState = {
          ...state,
          workouts: [...state.workouts, newWorkout],
        };
        saveGuestData(newState);
        return newState;
      });
      
      return id;
    },

    updateWorkout: (id, updates) => {
      set((state) => {
        const newState = {
          ...state,
          workouts: state.workouts.map(workout =>
            workout.id === id
              ? { ...workout, ...updates, updated_at: getCurrentUTCTimestamp() }
              : workout
          ),
        };
        saveGuestData(newState);
        return newState;
      });
    },

    deleteWorkout: (id) => {
      set((state) => {
        const newState = {
          ...state,
          workouts: state.workouts.filter(workout => workout.id !== id),
        };
        saveGuestData(newState);
        return newState;
      });
    },

    addExercise: (exercise) => {
      const id = generateRandomId();
      const now = getCurrentUTCTimestamp();
      const newExercise: GuestExercise = {
        ...exercise,
        id,
        exercise_sets: [],
        created_at: now,
        updated_at: now,
      };

      set((state) => {
        const newState = {
          ...state,
          workouts: state.workouts.map(workout =>
            workout.id === exercise.workout_id
              ? {
                  ...workout,
                  exercises: [...workout.exercises, newExercise],
                  updated_at: now,
                }
              : workout
          ),
        };
        saveGuestData(newState);
        return newState;
      });
      
      return id;
    },

    updateExercise: (id, updates) => {
      const now = getCurrentUTCTimestamp();
      set((state) => {
        const newState = {
          ...state,
          workouts: state.workouts.map(workout => ({
            ...workout,
            exercises: workout.exercises.map(exercise =>
              exercise.id === id
                ? { ...exercise, ...updates, updated_at: now }
                : exercise
            ),
          })),
        };
        saveGuestData(newState);
        return newState;
      });
    },

    deleteExercise: (id) => {
      set((state) => {
        const newState = {
          ...state,
          workouts: state.workouts.map(workout => ({
            ...workout,
            exercises: workout.exercises.filter(exercise => exercise.id !== id),
          })),
        };
        saveGuestData(newState);
        return newState;
      });
    },

    addExerciseSet: (exerciseSet) => {
      const id = generateRandomId();
      const now = getCurrentUTCTimestamp();
      const newExerciseSet: GuestExerciseSet = {
        ...exerciseSet,
        id,
        created_at: now,
        updated_at: now,
      };

      set((state) => {
        const newState = {
          ...state,
          workouts: state.workouts.map(workout => ({
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
        };
        saveGuestData(newState);
        return newState;
      });
      
      return id;
    },

    updateExerciseSet: (id, updates) => {
      const now = getCurrentUTCTimestamp();
      set((state) => {
        const newState = {
          ...state,
          workouts: state.workouts.map(workout => ({
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
        };
        saveGuestData(newState);
        return newState;
      });
    },

    deleteExerciseSet: (id) => {
      set((state) => {
        const newState = {
          ...state,
          workouts: state.workouts.map(workout => ({
            ...workout,
            exercises: workout.exercises.map(exercise => ({
              ...exercise,
              exercise_sets: exercise.exercise_sets.filter(set => set.id !== id),
            })),
          })),
        };
        saveGuestData(newState);
        return newState;
      });
    },

    addExerciseType: (exerciseType) => {
      const id = generateRandomId();
      const newExerciseType: GuestExerciseType = {
        ...exerciseType,
        id,
        times_used: 0,
      };
      
      set((state) => {
        const newState = {
          ...state,
          exerciseTypes: [...state.exerciseTypes, newExerciseType],
        };
        saveGuestData(newState);
        return newState;
      });
      
      return id;
    },

    updateExerciseType: (id, updates) => {
      set((state) => {
        const newState = {
          ...state,
          exerciseTypes: state.exerciseTypes.map(type =>
            type.id === id ? { ...type, ...updates } : type
          ),
        };
        saveGuestData(newState);
        return newState;
      });
    },

    addWorkoutType: (workoutType) => {
      const id = generateRandomId();
      const newWorkoutType: GuestWorkoutType = {
        ...workoutType,
        id,
      };
      
      set((state) => {
        const newState = {
          ...state,
          workoutTypes: [...state.workoutTypes, newWorkoutType],
        };
        saveGuestData(newState);
        return newState;
      });
      
      return id;
    },

    updateWorkoutType: (id, updates) => {
      set((state) => {
        const newState = {
          ...state,
          workoutTypes: state.workoutTypes.map(type =>
            type.id === id ? { ...type, ...updates } : type
          ),
        };
        saveGuestData(newState);
        return newState;
      });
    },

    // Routine-named implementation
    addRoutine: (routine) => {
      const id = generateRandomId();
      const now = getCurrentUTCTimestamp();
      const newRecipe: GuestRecipe = {
        ...routine,
        id,
        created_at: now,
        updated_at: now,
      };
      
      set((state) => {
        const newState = {
          ...state,
          recipes: [...(state.recipes || []), newRecipe],
        };
        saveGuestData(newState);
        return newState;
      });
      
      return id;
    },
    // Routine-named implementation
    deleteRoutine: (id) => {
      set((state) => {
        const newState = {
          ...state,
          recipes: (state.recipes || []).filter(recipe => recipe.id !== id),
        };
        saveGuestData(newState);
        return newState;
      });
    },
    // Routine-named implementation
    createRoutineFromWorkout: (workoutName, exercises) => {
      const id = generateRandomId();
      const now = getCurrentUTCTimestamp();
      
      const recipeExercises: GuestRecipeExercise[] = exercises.map(exercise => ({
        id: generateRandomId(),
        exercise_type_id: exercise.exercise_type_id,
        exercise_type: exercise.exercise_type,
        sets: exercise.exercise_sets.map(set => ({
          id: generateRandomId(),
          reps: set.reps,
          intensity: set.intensity,
          intensity_unit_id: set.intensity_unit_id,
          rest_time_seconds: set.rest_time_seconds,
        })),
        notes: exercise.notes || null,
      }));

      const newRecipe: GuestRecipe = {
        id,
        name: workoutName || 'My Routine',
        exercises: recipeExercises,
        created_at: now,
        updated_at: now,
      };

      set((state) => {
        const newState = {
          ...state,
          recipes: [...(state.recipes || []), newRecipe],
        };
        saveGuestData(newState);
        return newState;
      });
      
      return id;
    },
    // Routine-named implementation
    createExercisesFromRoutine: (recipe, workoutId) => {
      const exerciseIds: string[] = [];
      const { addExercise, addExerciseSet } = get();
      
      recipe.exercises.forEach(recipeExercise => {
        const exerciseId = addExercise({
          workout_id: workoutId,
          exercise_type_id: recipeExercise.exercise_type_id,
          exercise_type: recipeExercise.exercise_type,
          notes: recipeExercise.notes,
          timestamp: getCurrentUTCTimestamp(),
        });
        
        exerciseIds.push(exerciseId);
        
        recipeExercise.sets.forEach(recipeSet => {
          addExerciseSet({
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

    clear: () => {
      const initialData = getInitialGuestData();
      set({ ...initialData, hasAttemptedSync: false });
      try {
        localStorage.removeItem(GUEST_DATA_KEY);
      } catch (error) {
        console.warn('Failed to clear guest data from localStorage:', error);
      }
    },

    getWorkout: (id) => {
      return get().workouts.find(workout => workout.id === id);
    },

    getExercise: (id) => {
      const { workouts } = get();
      for (const workout of workouts) {
        const exercise = workout.exercises.find(ex => ex.id === id);
        if (exercise) return exercise;
      }
      return undefined;
    },

    syncWithServer: async () => {
      const state = get();
      const { user } = useAuthStore.getState();
      
      if (!user || state.hasAttemptedSync || state.workouts.length === 0) {
        return;
      }

      set({ hasAttemptedSync: true });
      
      try {
        const result = await syncGuestDataToServer(state, get().clear);
        if (result.success) {
          showSyncSuccessToast(result);
        } else {
          showSyncErrorToast(result.error ?? 'Unknown error');
          set({ hasAttemptedSync: false });
        }
      } catch (error) {
        console.error('Sync failed:', error);
        set({ hasAttemptedSync: false });
      }
    },
  };
});