import { toast } from "sonner";
import type { GuestData, GuestWorkout } from "../stores/useGuestStore";
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
  /** Guest workout ID -> server workout ID for every submitted workout on success. */
  workoutIdMap: Record<string, number>;
  /** Guest IDs whose submitted content this request saved; replays return []. */
  importedWorkoutIds: string[];
  /** Previously imported workouts since deleted on the server; the import fails when non-empty. */
  deletedWorkoutIds: string[];
}

export const emptySyncResult = (
  overrides: Partial<SyncResult> = {},
): SyncResult => ({
  success: true,
  syncedWorkouts: 0,
  syncedExercises: 0,
  syncedSets: 0,
  syncedRoutines: 0,
  workoutIdMap: {},
  importedWorkoutIds: [],
  deletedWorkoutIds: [],
  ...overrides,
});

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
): Promise<SyncResult> {
  try {
    // If no guest data to sync, return early
    if (guestData.workouts.length === 0) {
      return emptySyncResult();
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
            rir: s.rir,
            intensity_unit_id: s.intensity_unit_id,
            rest_time_seconds: s.rest_time_seconds,
            done: s.done,
            notes: s.notes,
            type: s.type,
            side: s.side,
            position: s.position,
          }))
        }))
      })),
      exerciseTypes: guestData.exerciseTypes.map(et => ({
        id: et.id,
        name: et.name,
        description: et.description,
        default_intensity_unit: et.default_intensity_unit,
        external_id: et.external_id
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

    const deletedWorkoutIds: string[] = result.deletedWorkoutIds ?? [];
    if (result.success) {
      return emptySyncResult({
        syncedWorkouts: result.syncedWorkouts,
        syncedExercises: result.syncedExercises,
        syncedSets: result.syncedSets,
        syncedRoutines: result.syncedRoutines,
        workoutIdMap: result.workoutIdMap ?? {},
        importedWorkoutIds: result.importedWorkoutIds ?? [],
        deletedWorkoutIds,
      });
    }
    return emptySyncResult({
      success: false,
      error: result.error || "Bulk sync failed on server",
      deletedWorkoutIds,
    });
  } catch (error) {
    logSyncFailure("guest bulk sync", {}, error);
    return emptySyncResult({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    });
  }
}

const isDeepEqual = (a: unknown, b: unknown): boolean => {
  if (Object.is(a, b)) return true;
  if (typeof a !== "object" || typeof b !== "object" || !a || !b) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  return (
    aKeys.length === bKeys.length &&
    aKeys.every(
      (key) =>
        Object.prototype.hasOwnProperty.call(b, key) &&
        isDeepEqual(
          (a as Record<string, unknown>)[key],
          (b as Record<string, unknown>)[key],
        ),
    )
  );
};

/**
 * Drops workouts the server holds exactly as they are now stored locally:
 * mapped by the server and unchanged since the dispatch snapshot. Anything
 * edited or created during sync stays local; types and routines are untouched.
 */
export const removeSyncedWorkouts = (
  current: GuestWorkout[],
  submitted: GuestWorkout[],
  result: SyncResult,
): GuestWorkout[] => {
  if (!result.success) return current;
  const snapshots = new Map(submitted.map((workout) => [workout.id, workout]));
  return current.filter((workout) => {
    const snapshot = snapshots.get(workout.id);
    const confirmed =
      snapshot !== undefined &&
      workout.id in result.workoutIdMap &&
      isDeepEqual(workout, snapshot);
    // An edited workout stays local even when listed in importedWorkoutIds: that confirms only the snapshot.
    // Follow-up: PATCH the edited version to result.workoutIdMap[workout.id] and remove it once the server confirms it.
    return !confirmed;
  });
};

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

export const showSyncDeletedWorkoutsToast = (count: number) => {
  toast.error(
    `${count} workout${count !== 1 ? "s were" : " was"} deleted from your account on the server. ${count !== 1 ? "They are" : "It is"} kept on this device and won't sync automatically.`,
  );
};
