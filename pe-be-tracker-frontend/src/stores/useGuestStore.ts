import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import {
  syncGuestDataToServer,
  showSyncSuccessToast,
  showSyncErrorToast,
} from "@/utils/syncGuestData";
import {
  generateRandomId,
  getCurrentUTCTimestamp,
  toUTCISOString,
} from "@/utils/date";
import { useAuthStore } from "./useAuthStore";
import { createIndexedDBStorage } from "./indexedDBStorage";
import { buildExerciseTypes } from "./seeds/exerciseTypes";
import { buildWorkoutTypes } from "./seeds/workoutTypes";
import { buildRecipes } from "./seeds/recipes";
import { generateExerciseTypeIds } from "./seeds/types";

export interface GuestExerciseType {
  id: string;
  name: string;
  description: string | null;
  default_intensity_unit: number;
  times_used: number;
  external_id?: string | null;
  images_url?: string | null;
  equipment?: string | null;
  instructions?: string | null;
  category?: string | null;
  created_at?: string;
  updated_at?: string;
  deleted_at?: string | null;
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
  deleted_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface GuestExercise {
  id: string;
  timestamp: string | null;
  notes: string | null;
  exercise_type_id: string;
  workout_id: string;
  deleted_at?: string | null;
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
  // Ephemeral flag set true after persisted state finishes rehydrating on client
  hydrated: boolean;
}

interface GuestActions {
  addWorkout: (
    workout: Omit<GuestWorkout, "id" | "created_at" | "updated_at">,
  ) => string;
  updateWorkout: (id: string, updates: Partial<GuestWorkout>) => void;
  deleteWorkout: (id: string) => void;

  addExercise: (
    exercise: Omit<
      GuestExercise,
      "id" | "created_at" | "updated_at" | "exercise_sets"
    >,
  ) => string;
  updateExercise: (id: string, updates: Partial<GuestExercise>) => void;
  deleteExercise: (id: string) => void;
  softDeleteExercise: (id: string) => void;
  restoreExercise: (id: string) => void;

  addExerciseSet: (
    exerciseSet: Omit<GuestExerciseSet, "id" | "created_at" | "updated_at">,
  ) => string;
  updateExerciseSet: (id: string, updates: Partial<GuestExerciseSet>) => void;
  deleteExerciseSet: (id: string) => void;
  softDeleteExerciseSet: (id: string) => void;
  restoreExerciseSet: (id: string) => void;

  addExerciseType: (
    exerciseType: Omit<GuestExerciseType, "id" | "times_used">,
  ) => string;
  updateExerciseType: (id: string, updates: Partial<GuestExerciseType>) => void;

  addWorkoutType: (workoutType: Omit<GuestWorkoutType, "id">) => string;
  updateWorkoutType: (id: string, updates: Partial<GuestWorkoutType>) => void;

  // Routine-named actions
  addRoutine: (
    routine: Omit<GuestRecipe, "id" | "created_at" | "updated_at">,
  ) => string;
  deleteRoutine: (id: string) => void;
  createRoutineFromWorkout: (
    workoutName: string,
    exercises: GuestExercise[],
  ) => string;
  createExercisesFromRoutine: (
    routine: GuestRecipe,
    workoutId: string,
  ) => string[];

  // Utility methods
  getActiveExercises: (workoutId?: string) => GuestExercise[];
  getActiveSets: (exerciseId?: string) => GuestExerciseSet[];

  clear: () => void;
  getWorkout: (id: string) => GuestWorkout | undefined;
  getExercise: (id: string) => GuestExercise | undefined;
  syncWithServer: () => Promise<void>;
  setHydrated: (hydrated: boolean) => void;
}

type GuestStore = GuestState & GuestActions;

const getInitialGuestData = (): GuestData => {
  // Create consistent IDs for exercises
  const exerciseTypeIds = generateExerciseTypeIds(generateRandomId);

  const exerciseTypes = buildExerciseTypes(exerciseTypeIds);

  const initialData = {
    workouts: [],
    exerciseTypes,
    workoutTypes: buildWorkoutTypes(generateRandomId),
    recipes: buildRecipes(exerciseTypeIds, generateRandomId),
  } satisfies GuestData;

  return initialData;
};

const parseIntensityValue = (value: string | null): number | null => {
  if (!value) return null;
  const parsed = parseFloat(value);
  return isNaN(parsed) ? null : parsed;
};

const normalizeTimestamp = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return value == null ? null : String(value);
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const normalized = toUTCISOString(trimmed);
  return normalized || trimmed;
};

const migrateGuestData = (data: any): GuestData => {
  const migrated = { ...data };

  if (!migrated.recipes) {
    migrated.recipes = [];
  }

  // Normalize timestamps and ensure arrays exist
  if (migrated.workouts) {
    migrated.workouts = migrated.workouts.map((workout: any) => ({
      ...workout,
      start_time: normalizeTimestamp(workout.start_time),
      end_time: normalizeTimestamp(workout.end_time),
      created_at: normalizeTimestamp(workout.created_at),
      updated_at: normalizeTimestamp(workout.updated_at),
      exercises:
        workout.exercises?.map((exercise: any) => ({
          ...exercise,
          timestamp: normalizeTimestamp(exercise.timestamp),
          created_at: normalizeTimestamp(exercise.created_at),
          updated_at: normalizeTimestamp(exercise.updated_at),
          exercise_sets:
            exercise.exercise_sets?.map((set: any) => ({
              ...set,
              created_at: normalizeTimestamp(set.created_at),
              updated_at: normalizeTimestamp(set.updated_at),
            })) ?? [],
        })) ?? [],
    }));
  }

  if (migrated.recipes) {
    migrated.recipes = migrated.recipes.map((recipe: any) => ({
      ...recipe,
      created_at: normalizeTimestamp(recipe.created_at),
      updated_at: normalizeTimestamp(recipe.updated_at),
      exercises:
        recipe.exercises?.map((exercise: any) => ({
          ...exercise,
          notes: exercise.notes ?? null,
          sets:
            exercise.sets?.map((set: any) => ({
              ...set,
            })) ?? [],
        })) ?? [],
    }));
  }

  return migrated as GuestData;
};

export const useGuestStore = create<GuestStore>()(
  persist(
    (set, get) => ({
      ...getInitialGuestData(),
      hasAttemptedSync: false,
      hydrated: false,

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
          ...state,
          workouts: [...state.workouts, newWorkout],
        }));

        return id;
      },

      updateWorkout: (id, updates) => {
        set((state) => ({
          ...state,
          workouts: state.workouts.map((workout) =>
            workout.id === id
              ? { ...workout, ...updates, updated_at: getCurrentUTCTimestamp() }
              : workout,
          ),
        }));
      },

      deleteWorkout: (id) => {
        set((state) => ({
          ...state,
          workouts: state.workouts.filter((workout) => workout.id !== id),
        }));
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

        set((state) => ({
          ...state,
          workouts: state.workouts.map((workout) =>
            workout.id === exercise.workout_id
              ? {
                  ...workout,
                  exercises: [...workout.exercises, newExercise],
                  updated_at: now,
                }
              : workout,
          ),
        }));

        return id;
      },

      updateExercise: (id, updates) => {
        const now = getCurrentUTCTimestamp();
        set((state) => ({
          ...state,
          workouts: state.workouts.map((workout) => ({
            ...workout,
            exercises: workout.exercises.map((exercise) =>
              exercise.id === id
                ? { ...exercise, ...updates, updated_at: now }
                : exercise,
            ),
          })),
        }));
      },

      deleteExercise: (id) => {
        set((state) => ({
          ...state,
          workouts: state.workouts.map((workout) => ({
            ...workout,
            exercises: workout.exercises.filter(
              (exercise) => exercise.id !== id,
            ),
          })),
        }));
      },

      softDeleteExercise: (id) => {
        const now = getCurrentUTCTimestamp();
        set((state) => ({
          ...state,
          workouts: state.workouts.map((workout) => ({
            ...workout,
            exercises: workout.exercises.map((exercise) =>
              exercise.id === id
                ? { ...exercise, deleted_at: now, updated_at: now }
                : exercise,
            ),
          })),
        }));
      },

      restoreExercise: (id) => {
        const now = getCurrentUTCTimestamp();
        set((state) => ({
          ...state,
          workouts: state.workouts.map((workout) => ({
            ...workout,
            exercises: workout.exercises.map((exercise) =>
              exercise.id === id
                ? { ...exercise, deleted_at: null, updated_at: now }
                : exercise,
            ),
          })),
        }));
      },

      addExerciseSet: (exerciseSet) => {
        const id = generateRandomId();
        const now = getCurrentUTCTimestamp();
        const newExerciseSet: GuestExerciseSet = {
          ...exerciseSet,
          id,
          intensity: exerciseSet.intensity,
          created_at: now,
          updated_at: now,
        };

        set((state) => ({
          ...state,
          workouts: state.workouts.map((workout) => ({
            ...workout,
            exercises: workout.exercises.map((exercise) =>
              exercise.id === exerciseSet.exercise_id
                ? {
                    ...exercise,
                    exercise_sets: [...exercise.exercise_sets, newExerciseSet],
                    updated_at: now,
                  }
                : exercise,
            ),
          })),
        }));

        return id;
      },

      updateExerciseSet: (id, updates) => {
        const now = getCurrentUTCTimestamp();
        set((state) => ({
          ...state,
          workouts: state.workouts.map((workout) => ({
            ...workout,
            exercises: workout.exercises.map((exercise) => ({
              ...exercise,
              exercise_sets: exercise.exercise_sets.map((set) =>
                set.id === id ? { ...set, ...updates, updated_at: now } : set,
              ),
            })),
          })),
        }));
      },

      deleteExerciseSet: (id) => {
        set((state) => ({
          ...state,
          workouts: state.workouts.map((workout) => ({
            ...workout,
            exercises: workout.exercises.map((exercise) => ({
              ...exercise,
              exercise_sets: exercise.exercise_sets.filter(
                (set) => set.id !== id,
              ),
            })),
          })),
        }));
      },

      softDeleteExerciseSet: (id) => {
        const now = getCurrentUTCTimestamp();
        set((state) => ({
          ...state,
          workouts: state.workouts.map((workout) => ({
            ...workout,
            exercises: workout.exercises.map((exercise) => ({
              ...exercise,
              exercise_sets: exercise.exercise_sets.map((set) =>
                set.id === id
                  ? { ...set, deleted_at: now, updated_at: now }
                  : set,
              ),
            })),
          })),
        }));
      },

      restoreExerciseSet: (id) => {
        const now = getCurrentUTCTimestamp();
        set((state) => ({
          ...state,
          workouts: state.workouts.map((workout) => ({
            ...workout,
            exercises: workout.exercises.map((exercise) => ({
              ...exercise,
              exercise_sets: exercise.exercise_sets.map((set) =>
                set.id === id
                  ? { ...set, deleted_at: null, updated_at: now }
                  : set,
              ),
            })),
          })),
        }));
      },

      addExerciseType: (exerciseType) => {
        const id = generateRandomId();
        const newExerciseType: GuestExerciseType = {
          ...exerciseType,
          id,
          times_used: 0,
        };

        set((state) => ({
          ...state,
          exerciseTypes: [...state.exerciseTypes, newExerciseType],
        }));

        return id;
      },

      updateExerciseType: (id, updates) => {
        set((state) => ({
          ...state,
          exerciseTypes: state.exerciseTypes.map((type) =>
            type.id === id ? { ...type, ...updates } : type,
          ),
        }));
      },

      addWorkoutType: (workoutType) => {
        const id = generateRandomId();
        const newWorkoutType: GuestWorkoutType = {
          ...workoutType,
          id,
        };

        set((state) => ({
          ...state,
          workoutTypes: [...state.workoutTypes, newWorkoutType],
        }));

        return id;
      },

      updateWorkoutType: (id, updates) => {
        set((state) => ({
          ...state,
          workoutTypes: state.workoutTypes.map((type) =>
            type.id === id ? { ...type, ...updates } : type,
          ),
        }));
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

        set((state) => ({
          ...state,
          recipes: [...(state.recipes || []), newRecipe],
        }));

        return id;
      },
      // Routine-named implementation
      deleteRoutine: (id) => {
        set((state) => ({
          ...state,
          recipes: (state.recipes || []).filter((recipe) => recipe.id !== id),
        }));
      },
      // Routine-named implementation
      createRoutineFromWorkout: (workoutName, exercises) => {
        const id = generateRandomId();
        const now = getCurrentUTCTimestamp();

        const recipeExercises: GuestRecipeExercise[] = exercises.map(
          (exercise) => ({
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
          }),
        );

        const newRecipe: GuestRecipe = {
          id,
          name: workoutName || "My Routine",
          exercises: recipeExercises,
          created_at: now,
          updated_at: now,
        };

        set((state) => ({
          ...state,
          recipes: [...(state.recipes || []), newRecipe],
        }));

        return id;
      },
      // Routine-named implementation
      createExercisesFromRoutine: (recipe, workoutId) => {
        const exerciseIds: string[] = [];
        const { addExercise, addExerciseSet } = get();

        recipe.exercises.forEach((recipeExercise) => {
          const exerciseId = addExercise({
            workout_id: workoutId,
            exercise_type_id: recipeExercise.exercise_type_id,
            exercise_type: recipeExercise.exercise_type,
            notes: recipeExercise.notes,
            timestamp: getCurrentUTCTimestamp(),
          });

          exerciseIds.push(exerciseId);

          recipeExercise.sets.forEach((recipeSet) => {
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
      },

      getWorkout: (id) => {
        return get().workouts.find((workout) => workout.id === id);
      },

      getExercise: (id) => {
        const { workouts } = get();
        for (const workout of workouts) {
          const exercise = workout.exercises.find((ex) => ex.id === id);
          if (exercise) return exercise;
        }
        return undefined;
      },

      getActiveExercises: (workoutId?: string) => {
        const { workouts } = get();
        if (workoutId) {
          const workout = workouts.find((w) => w.id === workoutId);
          return workout
            ? workout.exercises.filter((ex) => !ex.deleted_at)
            : [];
        }
        return workouts.flatMap((w) =>
          w.exercises.filter((ex) => !ex.deleted_at),
        );
      },

      getActiveSets: (exerciseId?: string) => {
        const { workouts } = get();
        if (exerciseId) {
          for (const workout of workouts) {
            const exercise = workout.exercises.find(
              (ex) => ex.id === exerciseId,
            );
            if (exercise) {
              return exercise.exercise_sets.filter((set) => !set.deleted_at);
            }
          }
          return [];
        }
        return workouts.flatMap((w) =>
          w.exercises.flatMap((ex) =>
            ex.exercise_sets.filter((set) => !set.deleted_at),
          ),
        );
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
            showSyncErrorToast(result.error ?? "Unknown error");
            set({ hasAttemptedSync: false });
          }
        } catch (error) {
          console.error("Sync failed:", error);
          set({ hasAttemptedSync: false });
        }
      },
      setHydrated: (hydrated) => set({ hydrated }),
    }),
    {
      name: "pe-guest-data",
      storage: createJSONStorage(() => createIndexedDBStorage()),
      version: 1,
      // Persist only data fields; exclude ephemeral flags/actions
      partialize: (state) => ({
        workouts: state.workouts,
        exerciseTypes: state.exerciseTypes,
        workoutTypes: state.workoutTypes,
        recipes: state.recipes,
        hasAttemptedSync: state.hasAttemptedSync,
      }),
      migrate: (persistedState: any, persistedVersion?: number) => {
        // Only run migration when version is missing/older (e.g., test seeds or pre-v1 data)
        if (persistedVersion == null || persistedVersion < 1) {
          const guest = migrateGuestData(persistedState);
          return {
            ...getInitialGuestData(),
            ...guest,
            hasAttemptedSync: Boolean(
              (persistedState as any)?.hasAttemptedSync,
            ),
          } as GuestState;
        }
        // Already at current version — return as-is
        return persistedState as GuestState;
      },
      onRehydrateStorage: () => (state, error) => {
        // Mark hydrated regardless of storage success or failure
        state?.setHydrated(true);
      },
    },
  ),
);
