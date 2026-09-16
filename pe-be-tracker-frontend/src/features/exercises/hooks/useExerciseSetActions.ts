import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

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
  createInitialWriteState,
  mergeUpdateData,
  reconcileExerciseSets,
  type SetDirtyField,
  type SetField,
  type SetWriteState,
} from "@/features/exercises/lib/exerciseSetWriter";
import {
  convertIntensityValue,
  DEFAULT_DURATION_SECONDS_FOR_SPEED_SETS,
  prefersDurationForIntensityUnit,
} from "@/features/exercises/lib/intensityUnits";
import { type SetValueMode } from "@/features/exercises/lib/setValue";
import { useAuthStore, useGuestStore } from "@/stores";

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
  const writeStatesRef = useRef<Map<string, SetWriteState>>(new Map());

  const invalidateExerciseQuery = useCallback(() => {
    if (!workoutId) {
      return;
    }

    void queryClient.invalidateQueries({ queryKey: ["exercises", workoutId] });
  }, [queryClient, workoutId]);

  const executeFlush = useCallback(async (key: string) => {
    const state = writeStatesRef.current.get(key);
    if (!state) {
      return;
    }

    if (state.isInFlight) {
      return;
    }

    if (!state.pendingPatch) {
      if (state.dirtyFields.size === 0 && !state.pendingTimer) {
        writeStatesRef.current.delete(key);
      }
      return;
    }

    const currentSet = exerciseSetsRef.current.find(
      (set) => getExerciseSetClientKey(set) === key,
    );
    const resolvedServerId = currentSet?.id ?? state.serverSetId;

    if (typeof resolvedServerId === "string" && resolvedServerId.startsWith("temp-")) {
      return;
    }

    state.serverSetId = resolvedServerId;
    const batchToSend = state.pendingPatch;
    state.pendingPatch = null;
    state.inFlightPatch = batchToSend;
    state.isInFlight = true;

    try {
      await updateExerciseSet(resolvedServerId, batchToSend);

      (Object.keys(batchToSend) as Array<keyof UpdateExerciseSetData>).forEach((field) => {
        if (field === "reps" || field === "duration_seconds" || field === "intensity") {
          if (!state.pendingPatch || !(field in state.pendingPatch)) {
            state.dirtyFields.delete(field as SetDirtyField);
          }
        }
      });
    } catch (error) {
      console.error("Failed to update exercise set:", error);
      state.pendingPatch = mergeUpdateData(batchToSend, state.pendingPatch);
      invalidateExerciseQuery();
    } finally {
      state.isInFlight = false;
      state.inFlightPatch = null;

      if (state.pendingPatch) {
        if (!state.pendingTimer) {
          state.pendingTimer = setTimeout(() => {
            state.pendingTimer = null;
            void executeFlush(key);
          }, 500);
        }
      } else if (state.dirtyFields.size === 0 && !state.pendingTimer) {
        writeStatesRef.current.delete(key);
      }
    }
  }, [invalidateExerciseQuery]);

  const queueSetUpdate = useCallback((
    setClientKey: string | number,
    serverSetId: string | number,
    data: UpdateExerciseSetData,
    field?: SetField,
  ) => {
    const key = String(setClientKey);
    let state = writeStatesRef.current.get(key);
    if (!state) {
      state = createInitialWriteState(serverSetId);
      writeStatesRef.current.set(key, state);
    } else if (!String(serverSetId).startsWith("temp-")) {
      state.serverSetId = serverSetId;
    }

    if (field === "weight") {
      state.dirtyFields.add("intensity");
    } else if (field === "reps" || field === "duration_seconds") {
      state.dirtyFields.add(field);
    }
    if ("reps" in data) state.dirtyFields.add("reps");
    if ("duration_seconds" in data) state.dirtyFields.add("duration_seconds");
    if ("intensity" in data) state.dirtyFields.add("intensity");

    state.pendingPatch = mergeUpdateData(state.pendingPatch, data);

    if (state.pendingTimer) {
      clearTimeout(state.pendingTimer);
    }

    state.pendingTimer = setTimeout(() => {
      state.pendingTimer = null;
      void executeFlush(key);
    }, 500);
  }, [executeFlush]);

  useEffect(() => {
    const rawSets = exercise.exercise_sets || [];
    const normalizedExerciseSets = normalizeExerciseSetClientKeys(
      sortExerciseSets(rawSets),
      exerciseSetsRef.current,
    );
    setExerciseSets((currentExerciseSets) => {
      const reconciled = reconcileExerciseSets(
        currentExerciseSets,
        normalizedExerciseSets,
        writeStatesRef.current,
      );

      if (areExerciseSetsShallowEqual(currentExerciseSets, reconciled)) {
        exerciseSetsRef.current = currentExerciseSets;
        return currentExerciseSets;
      }

      exerciseSetsRef.current = reconciled;
      return reconciled;
    });
  }, [exercise.exercise_sets]);

  useEffect(() => {
    latestExerciseRef.current = exercise;
  }, [exercise]);

  useEffect(() => {
    exerciseSetsRef.current = exerciseSets;
  }, [exerciseSets]);

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

  useEffect(() => {
    return () => {
      writeStatesRef.current.forEach((state, key) => {
        if (state.pendingTimer) {
          clearTimeout(state.pendingTimer);
          state.pendingTimer = null;
        }

        const dataToFlush = state.pendingPatch;
        if (!dataToFlush || state.isInFlight) {
          return;
        }

        const serverSetId =
          exerciseSetsRef.current.find(
            (set) => getExerciseSetClientKey(set) === key,
          )?.id ?? state.serverSetId;

        if (typeof serverSetId === "string" && serverSetId.startsWith("temp-")) {
          return;
        }

        void updateExerciseSet(serverSetId, dataToFlush).catch((error) => {
          console.error("Failed to flush update on unmount:", error);
        });
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

    queueSetUpdate(setId, currentSet.id, updateData, field);
  }, [applyLocalExerciseSets, isAuthenticated, queueSetUpdate]);

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

    queueSetUpdate(setId, currentSet.id, updates, mode === "time" ? "duration_seconds" : "reps");
  }, [applyLocalExerciseSets, isAuthenticated, queueSetUpdate]);

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

    const key = String(setId);
    const writeState = writeStatesRef.current.get(key);
    if (writeState?.pendingTimer) {
      clearTimeout(writeState.pendingTimer);
    }
    writeStatesRef.current.delete(key);

    applyLocalExerciseSets((currentExerciseSets) =>
      currentExerciseSets.filter(
        (set) => getExerciseSetClientKey(set) !== key,
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
      const writeState = writeStatesRef.current.get(tempId);
      if (writeState) {
        writeState.serverSetId = createdSet.id;
        if (writeState.pendingPatch && !writeState.isInFlight && !writeState.pendingTimer) {
          void executeFlush(tempId);
        }
      }
    } catch (error) {
      console.error("Failed to create exercise set:", error);
      invalidateExerciseQuery();
    }
  }, [applyLocalExerciseSets, executeFlush, exercise.id, isAuthenticated, invalidateExerciseQuery, isUnsavedExercise]);

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
