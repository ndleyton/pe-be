import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  createExerciseSet,
  deleteExercise,
  deleteExerciseSet,
  updateExerciseSet,
  type CreateExerciseSetData,
  type ExerciseSet,
  type UpdateExerciseSetData,
} from "@/features/exercises/api";
import {
  getExerciseSetClientKey,
  normalizeExerciseSetClientKeys,
  sortExerciseSets,
  toGuestExerciseSets,
  type ExerciseRowProps,
} from "@/features/exercises/lib/exerciseRow";
import {
  convertIntensityValue,
  DEFAULT_DURATION_SECONDS_FOR_SPEED_SETS,
  prefersDurationForIntensityUnit,
} from "@/features/exercises/lib/intensityUnits";
import { type SetValueMode } from "@/features/exercises/lib/setValue";
import { useAuthStore, useGuestStore } from "@/stores";

type SetField = "weight" | "reps" | "duration_seconds";

const areExerciseSetsShallowEqual = (
  left: ExerciseSet[],
  right: ExerciseSet[],
) =>
  left.length === right.length &&
  left.every((set, index) => set === right[index]);

export const useExerciseSetActions = ({
  exercise,
  onExerciseDelete,
  onExerciseUpdate,
  workoutId,
}: ExerciseRowProps) => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const guestDeleteExercise = useGuestStore((state) => state.deleteExercise);
  const queryClient = useQueryClient();

  const isUnsavedExercise =
    isAuthenticated &&
    typeof exercise.id === "string" &&
    exercise.id.startsWith("optimistic-");

  const [exerciseSets, setExerciseSets] = useState<ExerciseSet[]>(
    normalizeExerciseSetClientKeys(sortExerciseSets(exercise.exercise_sets || [])),
  );
  const exerciseSetsRef = useRef(exerciseSets);
  const latestExerciseRef = useRef(exercise);

  useEffect(() => {
    const normalizedExerciseSets = normalizeExerciseSetClientKeys(
      sortExerciseSets(exercise.exercise_sets || []),
      exerciseSetsRef.current,
    );
    setExerciseSets((currentExerciseSets) => {
      if (
        areExerciseSetsShallowEqual(
          currentExerciseSets,
          normalizedExerciseSets,
        )
      ) {
        exerciseSetsRef.current = currentExerciseSets;
        return currentExerciseSets;
      }

      exerciseSetsRef.current = normalizedExerciseSets;
      return normalizedExerciseSets;
    });
  }, [exercise.exercise_sets]);

  useEffect(() => {
    latestExerciseRef.current = exercise;
  }, [exercise]);

  useEffect(() => {
    exerciseSetsRef.current = exerciseSets;
  }, [exerciseSets]);

  const pendingUpdatesRef = useRef<
    Record<
      string,
      {
        timeout: ReturnType<typeof setTimeout> | null;
        data: UpdateExerciseSetData | null;
        inFlight: boolean;
        serverSetId: string | number;
      }
    >
  >({});

  const publishExerciseUpdate = useCallback((nextExerciseSets: ExerciseSet[]) => {
    if (!onExerciseUpdate) {
      return;
    }

    const updatedExercise = {
      ...latestExerciseRef.current,
      exercise_sets: isAuthenticated
        ? nextExerciseSets
        : toGuestExerciseSets(nextExerciseSets),
    };

    latestExerciseRef.current = updatedExercise;
    onExerciseUpdate(updatedExercise);
  }, [isAuthenticated, onExerciseUpdate]);

  const invalidateExerciseQuery = () => {
    if (!workoutId) {
      return;
    }

    void queryClient.invalidateQueries({ queryKey: ["exercises", workoutId] });
  };

  const flushSetUpdate = async (key: string) => {
    const update = pendingUpdatesRef.current[key];
    if (!update || update.inFlight || !update.data) return;

    const serverSetId = exerciseSetsRef.current.find(
      (set) => getExerciseSetClientKey(set) === key,
    )?.id ?? update.serverSetId;
    const data = update.data;
    update.data = null;
    update.inFlight = true;

    try {
      await updateExerciseSet(serverSetId, data);
    } catch (error) {
      console.error("Failed to update exercise set:", error);
      toast.error("Couldn't save set changes. Please check your connection and try again.");
      invalidateExerciseQuery();
    } finally {
      update.inFlight = false;
      if (update.data) {
        // A timer that expired during this request leaves its batch ready to send.
        // Send only newer input; failed batches are never automatically retried.
        if (!update.timeout) void flushSetUpdate(key);
      } else {
        delete pendingUpdatesRef.current[key];
      }
    }
  };

  useEffect(() => {
    return () => {
      Object.entries(pendingUpdatesRef.current).forEach(([key, update]) => {
        if (update.timeout) clearTimeout(update.timeout);
        update.timeout = null;
        // Use the same writer so cleanup cannot duplicate an in-flight request.
        void flushSetUpdate(key);
      });
    };
  }, []);

  const applyLocalExerciseSets = useCallback((
    updater:
      | ExerciseSet[]
      | ((currentExerciseSets: ExerciseSet[]) => ExerciseSet[]),
  ) => {
    const nextExerciseSets = sortExerciseSets(
      typeof updater === "function"
        ? updater(exerciseSetsRef.current)
        : updater,
    );

    exerciseSetsRef.current = nextExerciseSets;
    setExerciseSets(nextExerciseSets);
    publishExerciseUpdate(nextExerciseSets);
    return nextExerciseSets;
  }, [publishExerciseUpdate]);

  const queueSetUpdate = (
    setClientKey: string | number,
    serverSetId: string | number,
    data: UpdateExerciseSetData,
  ) => {
    const key = String(setClientKey);

    let update = pendingUpdatesRef.current[key];
    if (!update) {
      update = { timeout: null, data: null, serverSetId, inFlight: false };
      pendingUpdatesRef.current[key] = update;
    }
    if (update.timeout) clearTimeout(update.timeout);
    update.data = { ...update.data, ...data };
    update.serverSetId = serverSetId;
    update.timeout = setTimeout(() => {
      update.timeout = null;
      void flushSetUpdate(key);
    }, 500);
  };

  const updateSetField = useCallback((
    setId: string | number,
    field: SetField,
    value: number | null,
    displayUnitId?: number,
  ) => {
    const currentSet = exerciseSetsRef.current.find(
      (set) => getExerciseSetClientKey(set) === String(setId),
    );
    if (!currentSet) {
      return;
    }

    const nextValue =
      field === "weight"
        ? convertIntensityValue(
            value,
            displayUnitId ?? currentSet.intensity_unit_id,
            currentSet.intensity_unit_id,
          )
        : value;
    const localFieldUpdates =
      field === "weight"
        ? { intensity: nextValue }
        : field === "reps"
          ? { reps: value, duration_seconds: null }
          : { duration_seconds: value, reps: null };
    applyLocalExerciseSets((currentExerciseSets) =>
      currentExerciseSets.map((set) =>
        getExerciseSetClientKey(set) === String(setId)
          ? {
              ...set,
              ...localFieldUpdates,
            }
          : set,
      ),
    );

    if (!isAuthenticated) {
      return;
    }

    const updateData: UpdateExerciseSetData =
      field === "weight"
        ? { intensity: nextValue }
        : field === "reps"
          ? { reps: value, duration_seconds: null }
          : { duration_seconds: value, reps: null };

    queueSetUpdate(setId, currentSet.id, updateData);
  }, [applyLocalExerciseSets, isAuthenticated]);

  const incrementReps = useCallback((setId: string | number) => {
    const currentSet = exerciseSetsRef.current.find(
      (set) => getExerciseSetClientKey(set) === String(setId),
    );
    const nextReps = (currentSet?.reps || 0) + 1;
    updateSetField(setId, "reps", nextReps);
  }, [updateSetField]);

  const decrementReps = useCallback((setId: string | number) => {
    const currentSet = exerciseSetsRef.current.find(
      (set) => getExerciseSetClientKey(set) === String(setId),
    );
    const nextReps = Math.max((currentSet?.reps || 0) - 1, 0);
    updateSetField(setId, "reps", nextReps);
  }, [updateSetField]);

  const setSetValueMode = useCallback((
    setId: string | number,
    mode: SetValueMode,
  ) => {
    const currentSet = exerciseSetsRef.current.find(
      (set) => getExerciseSetClientKey(set) === String(setId),
    );
    if (!currentSet) {
      return;
    }

    const updates: Pick<UpdateExerciseSetData, "reps" | "duration_seconds"> =
      mode === "time"
        ? {
            reps: null,
            duration_seconds:
              currentSet.duration_seconds ?? DEFAULT_DURATION_SECONDS_FOR_SPEED_SETS,
          }
        : {
            reps: currentSet.reps ?? 0,
            duration_seconds: null,
          };

    applyLocalExerciseSets((currentExerciseSets) =>
      currentExerciseSets.map((set) =>
        getExerciseSetClientKey(set) === String(setId)
          ? {
              ...set,
              ...updates,
            }
          : set,
      ),
    );

    if (!isAuthenticated) {
      return;
    }

    queueSetUpdate(setId, currentSet.id, updates);
  }, [applyLocalExerciseSets, isAuthenticated]);

  const toggleSetCompletion = useCallback(async (setId: string | number) => {
    const currentSet = exerciseSetsRef.current.find(
      (set) => getExerciseSetClientKey(set) === String(setId),
    );
    if (!currentSet) {
      return;
    }

    applyLocalExerciseSets((currentExerciseSets) =>
      currentExerciseSets.map((set) =>
        getExerciseSetClientKey(set) === String(setId)
          ? {
              ...set,
              done: !set.done,
            }
          : set,
      ),
    );

    if (!isAuthenticated) {
      return;
    }

    try {
      await updateExerciseSet(currentSet.id, { done: !currentSet.done });
    } catch (error) {
      console.error("Failed to toggle exercise set completion:", error);
      invalidateExerciseQuery();
    }
  }, [applyLocalExerciseSets, isAuthenticated, invalidateExerciseQuery]);

  const updateSetOptions = useCallback(async (
    setId: string | number,
    updates: Pick<UpdateExerciseSetData, "notes" | "rpe" | "rir">,
  ) => {
    const currentSet = exerciseSetsRef.current.find(
      (set) => getExerciseSetClientKey(set) === String(setId),
    );
    if (!currentSet) {
      return;
    }

    applyLocalExerciseSets((currentExerciseSets) =>
      currentExerciseSets.map((set) =>
        getExerciseSetClientKey(set) === String(setId)
          ? {
              ...set,
              ...updates,
            }
          : set,
      ),
    );

    if (!isAuthenticated) {
      return;
    }

    try {
      await updateExerciseSet(currentSet.id, updates);
    } catch (error) {
      console.error("Failed to update exercise set options:", error);
      invalidateExerciseQuery();
    }
  }, [applyLocalExerciseSets, isAuthenticated, invalidateExerciseQuery]);

  const deleteSet = useCallback(async (setId: string | number) => {
    const currentSet = exerciseSetsRef.current.find(
      (set) => getExerciseSetClientKey(set) === String(setId),
    );
    if (!currentSet) {
      return;
    }

    applyLocalExerciseSets((currentExerciseSets) =>
      currentExerciseSets.filter(
        (set) => getExerciseSetClientKey(set) !== String(setId),
      ),
    );

    if (!isAuthenticated) {
      return;
    }

    try {
      await deleteExerciseSet(currentSet.id);
    } catch (error) {
      console.error("Failed to delete exercise set:", error);
      invalidateExerciseQuery();
    }
  }, [applyLocalExerciseSets, isAuthenticated, invalidateExerciseQuery]);

  const addSet = useCallback(async (intensityUnitId: number) => {
    if (isUnsavedExercise) {
      return;
    }

    const currentExerciseSets = exerciseSetsRef.current;
    const lastSet = currentExerciseSets[currentExerciseSets.length - 1];
    const durationPreferred = prefersDurationForIntensityUnit(intensityUnitId);
    const nextDurationSeconds = durationPreferred
      ? (lastSet?.duration_seconds ?? DEFAULT_DURATION_SECONDS_FOR_SPEED_SETS)
      : (lastSet?.duration_seconds ?? null);
    const nextReps = durationPreferred ? null : (lastSet?.reps ?? null);
    const tempId = `temp-${Date.now()}`;
    const nextSetType = currentExerciseSets.length === 0 ? "warmup" : "working";
    const nextIntensity = convertIntensityValue(
      lastSet?.intensity ?? null,
      lastSet?.intensity_unit_id,
      intensityUnitId,
    );
    const optimisticSet: ExerciseSet = {
      id: tempId,
      client_key: tempId,
      reps: nextReps,
      duration_seconds: nextDurationSeconds,
      intensity: nextIntensity,
      rpe: lastSet?.rpe ?? null,
      rir: lastSet?.rir ?? null,
      intensity_unit_id: intensityUnitId,
      exercise_id: exercise.id,
      rest_time_seconds: null,
      done: false,
      notes: null,
      type: nextSetType,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    applyLocalExerciseSets((existingExerciseSets) => [
      ...existingExerciseSets,
      optimisticSet,
    ]);

    if (!isAuthenticated) {
      return;
    }

    try {
      const payload: CreateExerciseSetData = {
        intensity: nextIntensity || 0,
        rpe: lastSet?.rpe ?? null,
        rir: lastSet?.rir ?? null,
        intensity_unit_id: intensityUnitId,
        exercise_id: exercise.id,
        rest_time_seconds: 0,
        done: false,
        notes: undefined,
        type: nextSetType,
        ...(nextDurationSeconds != null
          ? { duration_seconds: nextDurationSeconds }
          : { reps: nextReps || 0 }),
      };

      const createdSet = await createExerciseSet(payload);
      applyLocalExerciseSets((existingExerciseSets) =>
        existingExerciseSets.map((set) =>
          getExerciseSetClientKey(set) === String(tempId)
            ? {
                ...createdSet,
                client_key: set.client_key ?? tempId,
              }
            : set,
        ),
      );
      const pendingUpdate = pendingUpdatesRef.current[tempId];
      if (pendingUpdate) {
        pendingUpdate.serverSetId = createdSet.id;
      }
    } catch (error) {
      console.error("Failed to create exercise set:", error);
      invalidateExerciseQuery();
    }
  }, [applyLocalExerciseSets, exercise.id, isAuthenticated, invalidateExerciseQuery, isUnsavedExercise]);

  const updateExerciseNotes = useCallback((notes: string) => {
    if (!onExerciseUpdate) {
      return;
    }

    const updatedExercise = {
      ...latestExerciseRef.current,
      notes,
    };

    latestExerciseRef.current = updatedExercise;
    onExerciseUpdate(updatedExercise);
  }, [onExerciseUpdate]);

  const handleExerciseDelete = useCallback(async () => {
    if (isUnsavedExercise) {
      return;
    }

    try {
      if (isAuthenticated) {
        await deleteExercise(exercise.id);
      } else {
        guestDeleteExercise(String(exercise.id));
      }

      onExerciseDelete?.(exercise.id);
    } catch (error) {
      console.error("Error deleting exercise:", error);
    }
  }, [exercise.id, guestDeleteExercise, isAuthenticated, isUnsavedExercise, onExerciseDelete]);

  return {
    addSet,
    decrementReps,
    deleteSet,
    exerciseSets,
    handleExerciseDelete,
    incrementReps,
    isAuthenticated,
    isUnsavedExercise,
    setSetValueMode,
    toggleSetCompletion,
    updateExerciseNotes,
    updateSetField,
    updateSetOptions,
  };
};
