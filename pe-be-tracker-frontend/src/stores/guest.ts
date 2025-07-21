import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { generateRandomId, getCurrentUTCTimestamp } from '@/utils/date';

// Re-export interfaces from existing context
export interface GuestExerciseType {
  id: string;
  name: string;
  description: string | null;
  default_intensity_unit: number;
  times_used: number;
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

interface GuestStore {
  // State
  workouts: GuestWorkout[];
  exerciseTypes: GuestExerciseType[];
  workoutTypes: GuestWorkoutType[];
  recipes: GuestRecipe[];

  // Workout actions
  addWorkout: (workout: Omit<GuestWorkout, 'id' | 'created_at' | 'updated_at'>) => string;
  updateWorkout: (id: string, updates: Partial<GuestWorkout>) => void;
  deleteWorkout: (id: string) => void;
  getWorkout: (id: string) => GuestWorkout | undefined;

  // Exercise actions
  addExercise: (exercise: Omit<GuestExercise, 'id' | 'created_at' | 'updated_at' | 'exercise_sets'>) => string;
  updateExercise: (id: string, updates: Partial<GuestExercise>) => void;
  deleteExercise: (id: string) => void;
  getExercise: (id: string) => GuestExercise | undefined;

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
}

const getInitialData = () => ({
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
  ],
  recipes: [],
});

export const useGuestStore = create<GuestStore>()(
  persist(
    (set, get) => ({
      ...getInitialData(),

      // Workout actions
      addWorkout: (workout) => {
        const id = generateRandomId();
        const now = getCurrentUTCTimestamp();
        const newWorkout: GuestWorkout = {
          ...workout,
          id,
          created_at: now,
          updated_at: now,
        };
        set((state) => ({
          workouts: [...state.workouts, newWorkout],
        }));
        return id;
      },

      updateWorkout: (id, updates) => {
        set((state) => ({
          workouts: state.workouts.map((workout) =>
            workout.id === id
              ? { ...workout, ...updates, updated_at: getCurrentUTCTimestamp() }
              : workout
          ),
        }));
      },

      deleteWorkout: (id) => {
        set((state) => ({
          workouts: state.workouts.filter((workout) => workout.id !== id),
        }));
      },

      getWorkout: (id) => {
        return get().workouts.find((workout) => workout.id === id);
      },

      // Exercise actions
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

        set((state) => ({
          workouts: state.workouts.map((workout) =>
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
        const now = getCurrentUTCTimestamp();
        set((state) => ({
          workouts: state.workouts.map((workout) => ({
            ...workout,
            exercises: workout.exercises.map((exercise) =>
              exercise.id === id
                ? { ...exercise, ...updates, updated_at: now }
                : exercise
            ),
          })),
        }));
      },

      deleteExercise: (id) => {
        set((state) => ({
          workouts: state.workouts.map((workout) => ({
            ...workout,
            exercises: workout.exercises.filter((exercise) => exercise.id !== id),
          })),
        }));
      },

      getExercise: (id) => {
        const workouts = get().workouts;
        for (const workout of workouts) {
          const exercise = workout.exercises.find((ex) => ex.id === id);
          if (exercise) return exercise;
        }
        return undefined;
      },

      // Exercise set actions
      addExerciseSet: (exerciseSet) => {
        const id = generateRandomId();
        const now = getCurrentUTCTimestamp();
        const newExerciseSet: GuestExerciseSet = {
          ...exerciseSet,
          id,
          created_at: now,
          updated_at: now,
        };

        set((state) => ({
          workouts: state.workouts.map((workout) => ({
            ...workout,
            exercises: workout.exercises.map((exercise) =>
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
        const now = getCurrentUTCTimestamp();
        set((state) => ({
          workouts: state.workouts.map((workout) => ({
            ...workout,
            exercises: workout.exercises.map((exercise) => ({
              ...exercise,
              exercise_sets: exercise.exercise_sets.map((set) =>
                set.id === id
                  ? { ...set, ...updates, updated_at: now }
                  : set
              ),
            })),
          })),
        }));
      },

      deleteExerciseSet: (id) => {
        set((state) => ({
          workouts: state.workouts.map((workout) => ({
            ...workout,
            exercises: workout.exercises.map((exercise) => ({
              ...exercise,
              exercise_sets: exercise.exercise_sets.filter((set) => set.id !== id),
            })),
          })),
        }));
      },

      // Exercise type actions
      addExerciseType: (exerciseType) => {
        const id = generateRandomId();
        const newExerciseType: GuestExerciseType = {
          ...exerciseType,
          id,
          times_used: 0,
        };
        set((state) => ({
          exerciseTypes: [...state.exerciseTypes, newExerciseType],
        }));
        return id;
      },

      updateExerciseType: (id, updates) => {
        set((state) => ({
          exerciseTypes: state.exerciseTypes.map((type) =>
            type.id === id ? { ...type, ...updates } : type
          ),
        }));
      },

      // Workout type actions
      addWorkoutType: (workoutType) => {
        const id = generateRandomId();
        const newWorkoutType: GuestWorkoutType = {
          ...workoutType,
          id,
        };
        set((state) => ({
          workoutTypes: [...state.workoutTypes, newWorkoutType],
        }));
        return id;
      },

      updateWorkoutType: (id, updates) => {
        set((state) => ({
          workoutTypes: state.workoutTypes.map((type) =>
            type.id === id ? { ...type, ...updates } : type
          ),
        }));
      },

      // Recipe actions
      addRecipe: (recipe) => {
        const id = generateRandomId();
        const now = getCurrentUTCTimestamp();
        const newRecipe: GuestRecipe = {
          ...recipe,
          id,
          created_at: now,
          updated_at: now,
        };
        set((state) => ({
          recipes: [...state.recipes, newRecipe],
        }));
        return id;
      },

      deleteRecipe: (id) => {
        set((state) => ({
          recipes: state.recipes.filter((recipe) => recipe.id !== id),
        }));
      },

      createRecipeFromWorkout: (workoutName, exercises) => {
        const id = generateRandomId();
        const now = getCurrentUTCTimestamp();

        const recipeExercises: GuestRecipeExercise[] = exercises.map((exercise) => ({
          id: generateRandomId(),
          exercise_type_id: exercise.exercise_type_id,
          exercise_type: exercise.exercise_type,
          sets: exercise.exercise_sets.map((set) => ({
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
          name: workoutName || 'My Recipe',
          exercises: recipeExercises,
          created_at: now,
          updated_at: now,
        };

        set((state) => ({
          recipes: [...state.recipes, newRecipe],
        }));

        return id;
      },

      createExercisesFromRecipe: (recipe, workoutId) => {
        const exerciseIds: string[] = [];
        const actions = get();

        recipe.exercises.forEach((recipeExercise) => {
          const exerciseId = actions.addExercise({
            workout_id: workoutId,
            exercise_type_id: recipeExercise.exercise_type_id,
            exercise_type: recipeExercise.exercise_type,
            notes: recipeExercise.notes,
            timestamp: getCurrentUTCTimestamp(),
          });

          exerciseIds.push(exerciseId);

          recipeExercise.sets.forEach((recipeSet) => {
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
        set(getInitialData());
      },
    }),
    {
      name: 'pe-guest-data',
      // Only persist the data, not the actions
      partialize: (state) => ({
        workouts: state.workouts,
        exerciseTypes: state.exerciseTypes,
        workoutTypes: state.workoutTypes,
        recipes: state.recipes,
      }),
      // Migration for existing data
      migrate: (persistedState: any, version: number) => {
        if (!persistedState.recipes) {
          persistedState.recipes = [];
        }
        return persistedState;
      },
      version: 1,
    }
  )
);

// Selector functions to prevent infinite loops
export const selectWorkouts = (state: GuestStore) => state.workouts;
export const selectExerciseTypes = (state: GuestStore) => state.exerciseTypes;
export const selectWorkoutTypes = (state: GuestStore) => state.workoutTypes;
export const selectRecipes = (state: GuestStore) => state.recipes;