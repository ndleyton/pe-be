import { GuestData } from "../stores/useGuestStore";
import api from "@/shared/api/client";
import { endpoints } from "@/shared/api/endpoints";
import { toUTCISOString } from "./date";

export interface SyncResult {
  success: boolean;
  error?: string;
  syncedWorkouts: number;
  syncedExercises: number;
  syncedSets: number;
  syncedRoutines: number;
}

interface GuestSyncMarker {
  signature: string;
  status: "in_progress" | "complete";
  timestamp: number;
}

const GUEST_SYNC_MARKER_KEY = "pe-guest-sync-marker";
const GUEST_SYNC_MARKER_TTL_MS = 5 * 60 * 1000;

let activeGuestSync:
  | {
      signature: string;
      promise: Promise<SyncResult>;
    }
  | null = null;

const describeSyncError = (error: unknown) => {
  if (error instanceof Error) {
    return {
      message: error.message,
      name: error.name,
      stack: error.stack,
    };
  }

  return {
    value: error,
  };
};

const logSyncFailure = (
  stage: string,
  context: Record<string, unknown>,
  error: unknown,
) => {
  console.error(`Guest sync failed during ${stage}`, {
    ...context,
    error: describeSyncError(error),
  });
};

const getEmptySyncResult = (): SyncResult => ({
  success: true,
  syncedWorkouts: 0,
  syncedExercises: 0,
  syncedSets: 0,
  syncedRoutines: 0,
});

const buildGuestSyncSignature = (guestData: GuestData) =>
  JSON.stringify(guestData);

const getStoredGuestSyncMarker = (): GuestSyncMarker | null => {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const rawMarker = window.localStorage.getItem(GUEST_SYNC_MARKER_KEY);
    if (!rawMarker) {
      return null;
    }

    const marker = JSON.parse(rawMarker) as GuestSyncMarker;
    if (
      typeof marker.signature !== "string"
      || typeof marker.timestamp !== "number"
      || (marker.status !== "in_progress" && marker.status !== "complete")
    ) {
      window.localStorage.removeItem(GUEST_SYNC_MARKER_KEY);
      return null;
    }

    if (Date.now() - marker.timestamp > GUEST_SYNC_MARKER_TTL_MS) {
      window.localStorage.removeItem(GUEST_SYNC_MARKER_KEY);
      return null;
    }

    return marker;
  } catch (error) {
    console.warn("Failed to read guest sync marker:", error);
    return null;
  }
};

const setStoredGuestSyncMarker = (
  signature: string,
  status: GuestSyncMarker["status"],
) => {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(
      GUEST_SYNC_MARKER_KEY,
      JSON.stringify({
        signature,
        status,
        timestamp: Date.now(),
      } satisfies GuestSyncMarker),
    );
  } catch (error) {
    console.warn("Failed to write guest sync marker:", error);
  }
};

const clearStoredGuestSyncMarker = (signature?: string) => {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const marker = getStoredGuestSyncMarker();
    if (!marker) {
      return;
    }

    if (!signature || marker.signature === signature) {
      window.localStorage.removeItem(GUEST_SYNC_MARKER_KEY);
    }
  } catch (error) {
    console.warn("Failed to clear guest sync marker:", error);
  }
};

// Helper function to find or create exercise types on the server
const findOrCreateExerciseType = async (
  guestExerciseType: any,
): Promise<number> => {
  try {
    // First try to find existing exercise type by name
    const { data: response } = await api.get(
      `${endpoints.exerciseTypes}?name=${encodeURIComponent(guestExerciseType.name)}&released_only=true`,
    );
    const existingTypes = response.data;
    const existing = existingTypes.find(
      (type: any) =>
        type.name.toLowerCase() === guestExerciseType.name.toLowerCase(),
    );

    if (existing) {
      return existing.id;
    }

    // Create new exercise type if not found
    try {
      const { data: newType } = await api.post(endpoints.exerciseTypes, {
        name: guestExerciseType.name,
        description: guestExerciseType.description ?? "",
        default_intensity_unit: guestExerciseType.default_intensity_unit,
      });
      return newType.id;
    } catch (err: any) {
      // If duplicate (400) occurred between GET and POST, fetch again
      if (err?.response?.status === 400) {
        const { data: response } = await api.get(
          `${endpoints.exerciseTypes}?name=${encodeURIComponent(guestExerciseType.name)}&released_only=true`,
        );
        const existingTypesAfter = response.data;
        const existingAfter = existingTypesAfter.find(
          (type: any) =>
            type.name.toLowerCase() === guestExerciseType.name.toLowerCase(),
        );
        if (existingAfter) return existingAfter.id;
      }
      throw err;
    }
  } catch (error) {
    console.error("Error finding/creating exercise type:", error);
    throw error;
  }
};

// Helper function to find or create workout types on the server
const findOrCreateWorkoutType = async (
  guestWorkoutType: any,
): Promise<number> => {
  try {
    // First try to find existing workout type by name
    const { data: response } = await api.get(endpoints.workoutTypes);
    const existingTypes = Array.isArray(response) ? response : response.data;
    const existing = existingTypes.find(
      (type: any) =>
        type.name.toLowerCase() === guestWorkoutType.name.toLowerCase(),
    );

    if (existing) {
      return existing.id;
    }

    // Create new workout type if not found
    try {
      const { data: newType } = await api.post(endpoints.workoutTypes, {
        name: guestWorkoutType.name,
        description: guestWorkoutType.description ?? "",
      });
      return newType.id;
    } catch (err: any) {
      if (err?.response?.status === 400) {
        const { data: response } = await api.get(endpoints.workoutTypes);
        const existingAfter = Array.isArray(response)
          ? response
          : response.data;
        const existingAfterMatch = existingAfter.find(
          (type: any) =>
            type.name.toLowerCase() === guestWorkoutType.name.toLowerCase(),
        );
        if (existingAfterMatch) return existingAfterMatch.id;
      }
      throw err;
    }
  } catch (error) {
    console.error("Error finding/creating workout type:", error);
    throw error;
  }
};

export async function syncGuestDataToServer(
  guestData: GuestData,
  clearGuestData: () => void,
): Promise<SyncResult> {
  const signature = buildGuestSyncSignature(guestData);

  if (activeGuestSync?.signature === signature) {
    return activeGuestSync.promise;
  }

  const existingMarker = getStoredGuestSyncMarker();
  if (existingMarker?.signature === signature) {
    if (existingMarker.status === "complete") {
      clearGuestData();
      return getEmptySyncResult();
    }

    return getEmptySyncResult();
  }

  setStoredGuestSyncMarker(signature, "in_progress");

  const syncPromise = performGuestDataSync(guestData, clearGuestData, signature);
  activeGuestSync = {
    signature,
    promise: syncPromise,
  };

  return syncPromise.finally(() => {
    if (activeGuestSync?.signature === signature) {
      activeGuestSync = null;
    }
  });
}

async function performGuestDataSync(
  guestData: GuestData,
  clearGuestData: () => void,
  signature: string,
): Promise<SyncResult> {
  let syncedWorkouts = 0;
  let syncedExercises = 0;
  let syncedSets = 0;
  let syncedRoutines = 0;
  let hadFailures = false;

  try {
    // If no guest data to sync, return early
    if (guestData.workouts.length === 0) {
      clearStoredGuestSyncMarker(signature);
      return {
        ...getEmptySyncResult(),
      };
    }

    // Create maps to track guest ID to server ID mappings
    const exerciseTypeIdMap = new Map<string, number>();
    const workoutTypeIdMap = new Map<string, number>();

    // First, sync all unique exercise types
    const uniqueExerciseTypes = new Map();
    guestData.workouts.forEach((workout) => {
      workout.exercises.forEach((exercise) => {
        if (!uniqueExerciseTypes.has(exercise.exercise_type.id)) {
          uniqueExerciseTypes.set(
            exercise.exercise_type.id,
            exercise.exercise_type,
          );
        }
      });
    });

    for (const [guestId, exerciseType] of uniqueExerciseTypes) {
      const serverId = await findOrCreateExerciseType(exerciseType);
      exerciseTypeIdMap.set(guestId, serverId);
    }

    // Then, sync all unique workout types
    const uniqueWorkoutTypes = new Map();
    guestData.workouts.forEach((workout) => {
      if (!uniqueWorkoutTypes.has(workout.workout_type.id)) {
        uniqueWorkoutTypes.set(workout.workout_type.id, workout.workout_type);
      }
    });

    for (const [guestId, workoutType] of uniqueWorkoutTypes) {
      const serverId = await findOrCreateWorkoutType(workoutType);
      workoutTypeIdMap.set(guestId, serverId);
    }

    // Now sync each workout
    for (const guestWorkout of guestData.workouts) {
      try {
        const serverWorkoutTypeId = workoutTypeIdMap.get(
          guestWorkout.workout_type_id,
        );
        if (!serverWorkoutTypeId) {
          throw new Error(
            `No server ID found for workout type ${guestWorkout.workout_type_id}`,
          );
        }

        const workoutPayload = {
          name: guestWorkout.name,
          notes: guestWorkout.notes,
          start_time: guestWorkout.start_time
            ? toUTCISOString(guestWorkout.start_time)
            : null,
          end_time: guestWorkout.end_time
            ? toUTCISOString(guestWorkout.end_time)
            : null,
          workout_type_id: serverWorkoutTypeId,
        };
        const { data: createdWorkout } = await api.post(
          endpoints.workouts,
          workoutPayload,
        );

        syncedWorkouts++;

        // Sync exercises for this workout
        for (const guestExercise of guestWorkout.exercises) {
          try {
            const serverExerciseTypeId = exerciseTypeIdMap.get(
              guestExercise.exercise_type_id,
            );
            if (!serverExerciseTypeId) {
              throw new Error(
                `No server ID found for exercise type ${guestExercise.exercise_type_id}`,
              );
            }

            const exercisePayload = {
              exercise_type_id: serverExerciseTypeId,
              workout_id: createdWorkout.id,
              timestamp: guestExercise.timestamp
                ? toUTCISOString(guestExercise.timestamp)
                : null,
              notes: guestExercise.notes,
            };
            const { data: createdExercise } = await api.post(
              endpoints.exercises,
              exercisePayload,
            );

            syncedExercises++;

            // Sync exercise sets for this exercise
            for (const guestSet of guestExercise.exercise_sets) {
              try {
                const setPayload = {
                  reps: guestSet.reps,
                  duration_seconds: guestSet.duration_seconds ?? null,
                  intensity: guestSet.intensity,
                  rpe: guestSet.rpe ?? null,
                  intensity_unit_id: guestSet.intensity_unit_id,
                  exercise_id: createdExercise.id,
                  rest_time_seconds: guestSet.rest_time_seconds,
                  done: guestSet.done,
                };
                await api.post(endpoints.exerciseSets, setPayload);

                syncedSets++;
              } catch (setError) {
                hadFailures = true;
                logSyncFailure(
                  "exercise set sync",
                  {
                    createdExerciseId: createdExercise.id,
                    guestSetId: guestSet.id,
                    guestExerciseId: guestExercise.id,
                    guestWorkoutId: guestWorkout.id,
                  },
                  setError,
                );
                // Continue with other sets even if one fails
              }
            }
          } catch (exerciseError) {
            hadFailures = true;
            logSyncFailure(
              "exercise sync",
              {
                createdWorkoutId: createdWorkout.id,
                guestExerciseId: guestExercise.id,
                guestExerciseTypeId: guestExercise.exercise_type_id,
                guestWorkoutId: guestWorkout.id,
              },
              exerciseError,
            );
            // Continue with other exercises even if one fails
          }
        }
      } catch (workoutError) {
        hadFailures = true;
        logSyncFailure(
          "workout sync",
          {
            guestWorkoutId: guestWorkout.id,
            guestWorkoutTypeId: guestWorkout.workout_type_id,
          },
          workoutError,
        );
        // Continue with other workouts even if one fails
      }
    }

    if (hadFailures) {
      clearStoredGuestSyncMarker(signature);
      return {
        success: false,
        error:
          "Some of your guest data could not be synced. Your local data was kept so you can retry.",
        syncedWorkouts,
        syncedExercises,
        syncedSets,
        syncedRoutines,
      };
    }

    // Clear guest data after successful sync
    setStoredGuestSyncMarker(signature, "complete");
    clearGuestData();

    return {
      success: true,
      syncedWorkouts,
      syncedExercises,
      syncedSets,
      syncedRoutines,
    };
  } catch (error) {
    clearStoredGuestSyncMarker(signature);
    logSyncFailure("guest sync bootstrap", {}, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
      syncedWorkouts,
      syncedExercises,
      syncedSets,
      syncedRoutines,
    };
  }
}

// Helper function to show a toast notification
export const showSyncSuccessToast = (result: SyncResult) => {
  if (!result.success || result.syncedWorkouts === 0) {
    return; // No need to show toast if nothing was synced
  }

  const message = `Successfully synced ${result.syncedWorkouts} workout${result.syncedWorkouts !== 1 ? "s" : ""}, ${result.syncedRoutines} routine${result.syncedRoutines !== 1 ? "s" : ""}, ${result.syncedExercises} exercise${result.syncedExercises !== 1 ? "s" : ""}, and ${result.syncedSets} set${result.syncedSets !== 1 ? "s" : ""} to your account!`;

  // TODO: Replace with proper toast notification system
  console.info(message);
};

export const showSyncErrorToast = (error: string) => {
  const message = `Guest data sync incomplete: ${error}`;

  // For now, we'll use a simple alert, but this could be replaced with a proper toast library
  // TODO: Replace with proper toast notification system
  alert(message);
  console.error("Sync error:", message);
};
