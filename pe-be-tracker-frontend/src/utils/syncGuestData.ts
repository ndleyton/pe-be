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
}

// Helper function to find or create exercise types on the server
const findOrCreateExerciseType = async (
  guestExerciseType: any,
): Promise<number> => {
  try {
    // First try to find existing exercise type by name
    const { data: response } = await api.get(
      `${endpoints.exerciseTypes}?name=${encodeURIComponent(guestExerciseType.name)}`,
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
          `${endpoints.exerciseTypes}?name=${encodeURIComponent(guestExerciseType.name)}`,
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
  let syncedWorkouts = 0;
  let syncedExercises = 0;
  let syncedSets = 0;

  try {
    // If no guest data to sync, return early
    if (guestData.workouts.length === 0) {
      return {
        success: true,
        syncedWorkouts: 0,
        syncedExercises: 0,
        syncedSets: 0,
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
          "/workouts/",
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
              "/exercises/",
              exercisePayload,
            );

            syncedExercises++;

            // Sync exercise sets for this exercise
            for (const guestSet of guestExercise.exercise_sets) {
              try {
                const setPayload = {
                  reps: guestSet.reps,
                  intensity: guestSet.intensity,
                  intensity_unit_id: guestSet.intensity_unit_id,
                  exercise_id: createdExercise.id,
                  rest_time_seconds: guestSet.rest_time_seconds,
                  done: guestSet.done,
                };
                await api.post("/exercise-sets/", setPayload);

                syncedSets++;
              } catch (setError) {
                console.error(
                  `Failed to sync exercise set for exercise ID ${createdExercise.id}. Set data:`,
                  guestSet,
                  "Error:",
                  setError,
                );
                // Continue with other sets even if one fails
              }
            }
          } catch (exerciseError) {
            console.error(
              `Failed to sync exercise for workout ID ${createdWorkout.id}. Exercise data:`,
              guestExercise,
              "Error:",
              exerciseError,
            );
            // Continue with other exercises even if one fails
          }
        }
      } catch (workoutError) {
        console.error(
          `Failed to sync workout. Workout data:`,
          guestWorkout,
          "Error:",
          workoutError,
        );
        // Continue with other workouts even if one fails
      }
    }

    // Clear guest data after successful sync
    clearGuestData();

    return {
      success: true,
      syncedWorkouts,
      syncedExercises,
      syncedSets,
    };
  } catch (error) {
    console.error("Failed to sync guest data to server:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
      syncedWorkouts,
      syncedExercises,
      syncedSets,
    };
  }
}

// Helper function to show a toast notification
export const showSyncSuccessToast = (result: SyncResult) => {
  if (result.syncedWorkouts === 0) {
    return; // No need to show toast if nothing was synced
  }

  const message = `Successfully synced ${result.syncedWorkouts} workout${result.syncedWorkouts !== 1 ? "s" : ""}, ${result.syncedExercises} exercise${result.syncedExercises !== 1 ? "s" : ""}, and ${result.syncedSets} set${result.syncedSets !== 1 ? "s" : ""} to your account!`;

  // TODO: Replace with proper toast notification system
};

export const showSyncErrorToast = (error: string) => {
  const message = `Failed to sync your data: ${error}`;

  // For now, we'll use a simple alert, but this could be replaced with a proper toast library
  // TODO: Replace with proper toast notification system
  alert(message);
  console.error("Sync error:", message);
};
