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
} from "@/utils/date";
import type { Routine } from "@/features/routines/types";
import { useAuthStore } from "./useAuthStore";
import { createIndexedDBStorage } from "./indexedDBStorage";
import { migrateGuestData } from "./guestStoreMigration";
import { createInitialGuestData } from "./guestStoreSeedData";
import {
  removeExerciseById,
  removeExerciseSetById,
  updateExerciseById,
  updateExerciseSetById,
  updateWorkoutById,
} from "./guestStoreWorkoutTree";

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

export interface GuestData {
  workouts: GuestWorkout[];
  exerciseTypes: GuestExerciseType[];
  workoutTypes: GuestWorkoutType[];
  recipes?: never; // Deprecated
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
  createExercisesFromRoutine: (
    routine: Routine,
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
export const useGuestStore = create<GuestStore>()(
  persist(
    (set, get) => ({
      ...createInitialGuestData(generateRandomId),
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
          workouts: [...state.workouts, newWorkout],
        }));

        return id;
      },

      updateWorkout: (id, updates) => {
        set((state) => ({
          workouts: updateWorkoutById(state.workouts, id, (workout) => ({
            ...workout,
            ...updates,
            updated_at: getCurrentUTCTimestamp(),
          })),
        }));
      },

      deleteWorkout: (id) => {
        set((state) => ({
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
          workouts: updateWorkoutById(
            state.workouts,
            exercise.workout_id,
            (workout) => ({
              ...workout,
              exercises: [...workout.exercises, newExercise],
              updated_at: now,
            }),
          ),
        }));

        return id;
      },

      updateExercise: (id, updates) => {
        const now = getCurrentUTCTimestamp();
        set((state) => ({
          workouts: updateExerciseById(state.workouts, id, (exercise) => ({
            ...exercise,
            ...updates,
            updated_at: now,
          })),
        }));
      },

      deleteExercise: (id) => {
        set((state) => ({
          workouts: removeExerciseById(state.workouts, id),
        }));
      },

      softDeleteExercise: (id) => {
        const now = getCurrentUTCTimestamp();
        set((state) => ({
          workouts: updateExerciseById(state.workouts, id, (exercise) => ({
            ...exercise,
            deleted_at: now,
            updated_at: now,
          })),
        }));
      },

      restoreExercise: (id) => {
        const now = getCurrentUTCTimestamp();
        set((state) => ({
          workouts: updateExerciseById(state.workouts, id, (exercise) => ({
            ...exercise,
            deleted_at: null,
            updated_at: now,
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
          workouts: updateExerciseById(
            state.workouts,
            exerciseSet.exercise_id,
            (exercise) => ({
              ...exercise,
              exercise_sets: [...exercise.exercise_sets, newExerciseSet],
              updated_at: now,
            }),
          ),
        }));

        return id;
      },

      updateExerciseSet: (id, updates) => {
        const now = getCurrentUTCTimestamp();
        set((state) => ({
          workouts: updateExerciseSetById(state.workouts, id, (set) => ({
            ...set,
            ...updates,
            updated_at: now,
          })),
        }));
      },

      deleteExerciseSet: (id) => {
        set((state) => ({
          workouts: removeExerciseSetById(state.workouts, id),
        }));
      },

      softDeleteExerciseSet: (id) => {
        const now = getCurrentUTCTimestamp();
        set((state) => ({
          workouts: updateExerciseSetById(state.workouts, id, (set) => ({
            ...set,
            deleted_at: now,
            updated_at: now,
          })),
        }));
      },

      restoreExerciseSet: (id) => {
        const now = getCurrentUTCTimestamp();
        set((state) => ({
          workouts: updateExerciseSetById(state.workouts, id, (set) => ({
            ...set,
            deleted_at: null,
            updated_at: now,
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
          exerciseTypes: [...state.exerciseTypes, newExerciseType],
        }));

        return id;
      },

      updateExerciseType: (id, updates) => {
        set((state) => ({
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
          workoutTypes: [...state.workoutTypes, newWorkoutType],
        }));

        return id;
      },

      updateWorkoutType: (id, updates) => {
        set((state) => ({
          workoutTypes: state.workoutTypes.map((type) =>
            type.id === id ? { ...type, ...updates } : type,
          ),
        }));
      },
      createExercisesFromRoutine: (routine, workoutId) => {
        const exerciseIds: string[] = [];
        const { addExercise, addExerciseSet } = get();

        routine.exercise_templates.forEach((routineExercise) => {
          const exerciseType = routineExercise.exercise_type;
          if (!exerciseType) {
            return;
          }

          const exerciseId = addExercise({
            workout_id: workoutId,
            exercise_type_id: String(routineExercise.exercise_type_id),
            exercise_type: {
              id: String(exerciseType.id),
              name: exerciseType.name,
              description: exerciseType.description ?? null,
              default_intensity_unit: exerciseType.default_intensity_unit,
              times_used: exerciseType.times_used,
            },
            notes: null,
            timestamp: getCurrentUTCTimestamp(),
          });

          exerciseIds.push(exerciseId);

          routineExercise.set_templates.forEach((routineSet) => {
            addExerciseSet({
              exercise_id: exerciseId,
              reps: routineSet.reps ?? null,
              intensity: routineSet.intensity ?? null,
              intensity_unit_id: routineSet.intensity_unit_id,
              rest_time_seconds: null,
              done: false,
            });
          });
        });

        return exerciseIds;
      },

      clear: () => {
        const initialData = createInitialGuestData(generateRandomId);
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
      // Persist only data fields; exclude ephemeral flags/actions
      partialize: (state) => ({
        workouts: state.workouts,
        exerciseTypes: state.exerciseTypes,
        workoutTypes: state.workoutTypes,
        hasAttemptedSync: state.hasAttemptedSync,
      }),
      migrate: (persistedState: any, persistedVersion?: number) => {
        // Only run migration when version is missing/older (e.g., test seeds or pre-v1 data)
        if (persistedVersion == null || persistedVersion < 3) {
          const guest = migrateGuestData(persistedState);
          return {
            ...createInitialGuestData(generateRandomId),
            ...guest,
            hasAttemptedSync: Boolean(
              (persistedState as any)?.hasAttemptedSync,
            ),
          } as GuestState;
        }
        // Already at current version — return as-is
        return persistedState as GuestState;
      },
      version: 3,
      onRehydrateStorage: () => (state, _error) => {
        // Mark hydrated regardless of storage success or failure
        state?.setHydrated(true);
      },
    },
  ),
);
