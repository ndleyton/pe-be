import { toast } from "sonner";
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

export async function syncGuestDataToServer(
  guestData: GuestData,
  clearGuestData: () => void,
): Promise<SyncResult> {
  try {
    // If no guest data to sync, return early
    if (guestData.workouts.length === 0) {
      return {
        success: true,
        syncedWorkouts: 0,
        syncedExercises: 0,
        syncedSets: 0,
        syncedRoutines: 0,
      };
    }

    // Format the payload for the bulk sync endpoint
    const payload = {
      workouts: guestData.workouts.map(w => ({
        id: w.id,
        name: w.name,
        notes: w.notes,
        start_time: toUTCISOString(w.start_time),
        end_time: w.end_time ? toUTCISOString(w.end_time) : null,
        workout_type_id: w.workout_type_id,
        exercises: w.exercises.map(e => ({
          id: e.id,
          timestamp: e.timestamp ? toUTCISOString(e.timestamp) : null,
          notes: e.notes,
          exercise_type_id: e.exercise_type_id,
          exercise_sets: e.exercise_sets.map(s => ({
            id: s.id,
            reps: s.reps,
            duration_seconds: s.duration_seconds,
            intensity: s.intensity,
            rpe: s.rpe,
            intensity_unit_id: s.intensity_unit_id,
            rest_time_seconds: s.rest_time_seconds,
            done: s.done,
            notes: s.notes
          }))
        }))
      })),
      exerciseTypes: guestData.exerciseTypes.map(et => ({
        id: et.id,
        name: et.name,
        description: et.description,
        default_intensity_unit: et.default_intensity_unit
      })),
      workoutTypes: guestData.workoutTypes.map(wt => ({
        id: wt.id,
        name: wt.name,
        description: wt.description
      }))
    };

    const idempotencyKey = crypto.randomUUID?.() || `sync-${Date.now()}-${Math.random().toString(16).slice(2)}`;

    const { data: result } = await api.post(endpoints.sync, payload, {
      headers: {
        "X-Idempotency-Key": idempotencyKey,
      },
    });

    if (result.success) {
      // Clear guest data after successful sync
      clearGuestData();
      return {
        success: true,
        syncedWorkouts: result.syncedWorkouts,
        syncedExercises: result.syncedExercises,
        syncedSets: result.syncedSets,
        syncedRoutines: result.syncedRoutines,
      };
    } else {
      return {
        success: false,
        error: result.error || "Bulk sync failed on server",
        syncedWorkouts: 0,
        syncedExercises: 0,
        syncedSets: 0,
        syncedRoutines: 0,
      };
    }
  } catch (error) {
    logSyncFailure("guest bulk sync", {}, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
      syncedWorkouts: 0,
      syncedExercises: 0,
      syncedSets: 0,
      syncedRoutines: 0,
    };
  }
}

// Helper function to show a toast notification
export const showSyncSuccessToast = (result: SyncResult) => {
  if (!result.success || result.syncedWorkouts === 0) {
    return; // No need to show toast if nothing was synced
  }

  const message = `Successfully synced ${result.syncedWorkouts} workout${result.syncedWorkouts !== 1 ? "s" : ""}, ${result.syncedRoutines} routine${result.syncedRoutines !== 1 ? "s" : ""}, ${result.syncedExercises} exercise${result.syncedExercises !== 1 ? "s" : ""}, and ${result.syncedSets} set${result.syncedSets !== 1 ? "s" : ""} to your account!`;

  toast.success(message);
};

export const showSyncErrorToast = (error: string) => {
  const message = `Guest data sync incomplete: ${error}`;

  toast.error(message);
  console.error("Sync error:", message);
};
