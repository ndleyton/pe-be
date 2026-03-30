import { toUTCISOString } from "@/utils/date";
import type { GuestData } from "./useGuestStore";

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null;
};

const asRecord = (value: unknown): Record<string, unknown> => {
  return isRecord(value) ? value : {};
};

export const normalizeGuestTimestamp = (value: unknown): string | null => {
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

export const migrateGuestData = (data: unknown): GuestData => {
  const source = asRecord(data);
  const migrated: Record<string, unknown> = { ...source };

  if (Array.isArray(migrated.workouts)) {
    migrated.workouts = migrated.workouts.map((rawWorkout) => {
      const workout = asRecord(rawWorkout);
      const exercises = Array.isArray(workout.exercises)
        ? workout.exercises.map((rawExercise) => {
            const exercise = asRecord(rawExercise);
            const exerciseSets = Array.isArray(exercise.exercise_sets)
              ? exercise.exercise_sets.map((rawSet) => {
                  const set = asRecord(rawSet);
                  return {
                    ...set,
                    created_at: normalizeGuestTimestamp(set.created_at),
                    updated_at: normalizeGuestTimestamp(set.updated_at),
                  };
                })
              : [];

            return {
              ...exercise,
              timestamp: normalizeGuestTimestamp(exercise.timestamp),
              created_at: normalizeGuestTimestamp(exercise.created_at),
              updated_at: normalizeGuestTimestamp(exercise.updated_at),
              exercise_sets: exerciseSets,
            };
          })
        : [];

      return {
        ...workout,
        start_time: normalizeGuestTimestamp(workout.start_time),
        end_time: normalizeGuestTimestamp(workout.end_time),
        created_at: normalizeGuestTimestamp(workout.created_at),
        updated_at: normalizeGuestTimestamp(workout.updated_at),
        exercises,
      };
    });
  }

  return {
    workouts: Array.isArray(migrated.workouts) ? migrated.workouts as GuestData["workouts"] : [],
    exerciseTypes: Array.isArray(migrated.exerciseTypes)
      ? migrated.exerciseTypes as GuestData["exerciseTypes"]
      : [],
    workoutTypes: Array.isArray(migrated.workoutTypes)
      ? migrated.workoutTypes as GuestData["workoutTypes"]
      : [],
  };
};
