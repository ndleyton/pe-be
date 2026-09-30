import {
  getOrCreatePendingPair,
  clearPendingPair,
} from "@/features/exercises/lib/pendingSetPair";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { toast } from "sonner";

import {
  createExerciseSet,
  createExerciseSetPair,
  deleteExercise,
  deleteExerciseSet,
  updateExerciseSet,
  type CreateExerciseSetData,
  type ExerciseSet,
  type UpdateExerciseSetData,
} from "@/features/exercises/api";
import {
  getExerciseSetClientKey,
  isPendingPairSet,
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

// Responses where the pair endpoint rejected the payload itself: 400/422
// validation (e.g. unknown intensity unit), 404 exercise not found or not
// owned, 409 idempotency key bound to a different payload.
const PAIR_PAYLOAD_REJECTION_STATUSES = new Set([400, 404, 409, 422]);

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
  const userId = useAuthStore((state) => state.user?.id);
  const pairInFlightRef = useRef(false);
  const pendingDeletionsRef = useRef(new Set<string>());
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
    // Creation will resume this batch once a real ID is available.
    if (typeof serverSetId === "string" && serverSetId.startsWith("temp-")) return;

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
    if (!currentSet || isPendingPairSet(currentSet, isAuthenticated)) {
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
    if (!currentSet || isPendingPairSet(currentSet, isAuthenticated)) {
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
    if (!currentSet || isPendingPairSet(currentSet, isAuthenticated)) {
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

    if (
      (typeof currentSet.id === "string" && currentSet.id.startsWith("temp-")) ||
      pendingUpdatesRef.current[String(setId)]
    ) {
      queueSetUpdate(setId, currentSet.id, { done: !currentSet.done });
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
    updates: Pick<UpdateExerciseSetData, "notes" | "rpe" | "rir" | "side">,
  ) => {
    const currentSet = exerciseSetsRef.current.find(
      (set) => getExerciseSetClientKey(set) === String(setId),
    );
    if (!currentSet || isPendingPairSet(currentSet, isAuthenticated)) {
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
      if (typeof currentSet.id === "string" && currentSet.id.startsWith("temp-")) {
        queueSetUpdate(setId, currentSet.id, updates);
        return;
      }
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
    if (!currentSet || isPendingPairSet(currentSet, isAuthenticated)) {
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

    const key = String(setId);
    const pendingUpdate = pendingUpdatesRef.current[key];
    if (pendingUpdate?.timeout) clearTimeout(pendingUpdate.timeout);
    delete pendingUpdatesRef.current[key];
    if (typeof currentSet.id === "string" && currentSet.id.startsWith("temp-")) {
      pendingDeletionsRef.current.add(key);
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
      side: null,
      position: Math.max(-1, ...currentExerciseSets.map((set, index) => set.position ?? index)) + 1,
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
        side: null,
        ...(nextDurationSeconds != null
          ? { duration_seconds: nextDurationSeconds }
          : { reps: nextReps || 0 }),
      };

      const createdSet = await createExerciseSet(payload);
      if (pendingDeletionsRef.current.delete(tempId)) {
        await deleteExerciseSet(createdSet.id);
        return;
      }
      applyLocalExerciseSets((existingExerciseSets) =>
        existingExerciseSets.map((set) =>
          getExerciseSetClientKey(set) === String(tempId)
            ? {
                ...createdSet,
                ...pendingUpdatesRef.current[tempId]?.data,
                client_key: set.client_key ?? tempId,
              }
            : set,
        ),
      );
      const pendingUpdate = pendingUpdatesRef.current[tempId];
      if (pendingUpdate) {
        pendingUpdate.serverSetId = createdSet.id;
        if (!pendingUpdate.timeout) void flushSetUpdate(tempId);
      }
    } catch (error) {
      pendingDeletionsRef.current.delete(tempId);
      console.error("Failed to create exercise set:", error);
      invalidateExerciseQuery();
    }
  }, [applyLocalExerciseSets, exercise.id, isAuthenticated, invalidateExerciseQuery, isUnsavedExercise]);

  const addLeftRightPair = useCallback(async (intensityUnitId: number) => {
    if (isUnsavedExercise || pairInFlightRef.current) return;
    const current = exerciseSetsRef.current;
    const lastSet = current[current.length - 1];
    const firstPosition = Math.max(-1, ...current.map((set, index) => set.position ?? index)) + 1;
    const now = new Date().toISOString();
    let operationKey: string = crypto.randomUUID();
    let deletedSides: string[] = [];
    const durationPreferred = prefersDurationForIntensityUnit(intensityUnitId);
    const nextDurationSeconds = durationPreferred
      ? (lastSet?.duration_seconds ?? DEFAULT_DURATION_SECONDS_FOR_SPEED_SETS)
      : (lastSet?.duration_seconds ?? null);
    const nextReps = durationPreferred ? null : (lastSet?.reps ?? null);

    const common = {
      reps: nextReps,
      duration_seconds: nextDurationSeconds,
      intensity: convertIntensityValue(lastSet?.intensity ?? null, lastSet?.intensity_unit_id, intensityUnitId) ?? 0,
      rpe: lastSet?.rpe ?? null,
      rir: lastSet?.rir ?? null,
      intensity_unit_id: intensityUnitId,
      exercise_id: exercise.id,
      rest_time_seconds: 0,
      done: false as const,
      notes: null,
      type: current.length === 0 ? "warmup" : "working",
    };
    let pairSets: Parameters<typeof createExerciseSetPair>[1] = (["left", "right"] as const).map((side) => ({
      ...(nextDurationSeconds != null
        ? { duration_seconds: nextDurationSeconds }
        : { reps: nextReps || 0 }),
      intensity: common.intensity,
      rpe: common.rpe,
      rir: common.rir,
      intensity_unit_id: intensityUnitId,
      rest_time_seconds: 0,
      done: false,
      type: common.type,
      side,
    }));
    if (isAuthenticated) {
      try {
        if (userId == null) throw new Error("Missing user for pending pair");
        const pending = getOrCreatePendingPair(userId, exercise.id, pairSets);
        operationKey = pending.key;
        pairSets = pending.sets;
        deletedSides = pending.deletedSides ?? [];
      } catch (error) {
        console.error("Could not persist pair operation:", error);
        toast.error("Couldn't save the pending pair. Please try again.");
        return;
      }
    }
    const optimistic = pairSets.map((item, offset) => ({
      ...item,
      exercise_id: exercise.id,
      reps: item.reps ?? null,
      duration_seconds: item.duration_seconds ?? null,
      intensity: item.intensity ?? null,
      rpe: item.rpe ?? null,
      rir: item.rir ?? null,
      rest_time_seconds: item.rest_time_seconds ?? null,
      id: `temp-${operationKey}-${item.side}`,
      client_key: `temp-${operationKey}-${item.side}`,
      position: firstPosition + offset,
      created_at: now,
      updated_at: now,
    } satisfies ExerciseSet));
    // A replayed operation may include sides the user already deleted; they are
    // created server-side by the idempotent replay, so delete them once confirmed.
    const deletedKeys = new Set(
      optimistic
        .filter((item) => deletedSides.includes(item.side))
        .map((item) => String(item.client_key)),
    );
    if (isAuthenticated) {
      deletedKeys.forEach((key) => pendingDeletionsRef.current.add(key));
    }
    applyLocalExerciseSets([
      ...current,
      ...optimistic.filter((item) => !deletedKeys.has(String(item.client_key))),
    ]);
    if (!isAuthenticated) return;
    pairInFlightRef.current = true;
    try {
      const created = await createExerciseSetPair(exercise.id, pairSets, operationKey);
      clearPendingPair(userId!, exercise.id);
      // A refetch may already contain the committed rows after a lost response.
      // Keep those current values instead of replaying the original response.
      applyLocalExerciseSets((sets) => {
        const result = sets.filter((set) => !optimistic.some(
          (item) => getExerciseSetClientKey(item) === getExerciseSetClientKey(set),
        ));
        for (const row of created) {
          const opt = optimistic.find((item) => item.side === row.side);
          if (opt && pendingDeletionsRef.current.has(String(opt.client_key))) {
            const index = result.findIndex((set) => String(set.id) === String(row.id));
            if (index >= 0) result.splice(index, 1);
            continue;
          }
          if (!result.some((set) => String(set.id) === String(row.id))) {
            const pending = opt && pendingUpdatesRef.current[String(opt.client_key)];
            result.push({ ...row, ...pending?.data, client_key: opt?.client_key });
          }
        }
        return result;
      });

      for (const optItem of optimistic) {
        const createdMatch = created.find((c) => c.side === optItem.side);
        if (createdMatch) {
          const tempId = String(optItem.client_key);
          if (pendingDeletionsRef.current.delete(tempId)) {
            try {
              await deleteExerciseSet(createdMatch.id);
            } catch (error) {
              console.error("Failed to delete exercise set:", error);
              invalidateExerciseQuery();
            }
            continue;
          }
          const pendingUpdate = pendingUpdatesRef.current[tempId];
          if (pendingUpdate) {
            pendingUpdate.serverSetId = createdMatch.id;
            if (!pendingUpdate.timeout) void flushSetUpdate(tempId);
          }
        }
      }
    } catch (error) {
      console.error("Failed to create left/right pair:", error);
      // Drop the pending pair only when the server definitively rejected this
      // payload, so replaying it can never succeed. Any other failure (network,
      // 5xx, 401/403/429, ...) may follow a committed attempt whose response was
      // lost; the key must survive so the retry replays instead of duplicating.
      const status = axios.isAxiosError(error) ? error.response?.status : undefined;
      if (status != null && PAIR_PAYLOAD_REJECTION_STATUSES.has(status)) {
        clearPendingPair(userId!, exercise.id);
      }
      const optimisticKeys = new Set(
        optimistic.map((item) => getExerciseSetClientKey(item)),
      );
      optimisticKeys.forEach((key) => {
        pendingDeletionsRef.current.delete(key);
        const pendingUpdate = pendingUpdatesRef.current[key];
        if (pendingUpdate?.timeout) clearTimeout(pendingUpdate.timeout);
        delete pendingUpdatesRef.current[key];
      });
      applyLocalExerciseSets((sets) =>
        sets.filter((set) => !optimisticKeys.has(getExerciseSetClientKey(set))),
      );
      toast.error("Couldn't confirm the pair. Choose Add left + right sets to retry safely.");
      invalidateExerciseQuery();
    } finally {
      pairInFlightRef.current = false;
    }
  }, [applyLocalExerciseSets, exercise.id, invalidateExerciseQuery, isAuthenticated, isUnsavedExercise, userId]);

  const updateExerciseNotes = useCallback((notes: string) => {
    if (!onExerciseUpdate) {
      return;
    }

    const updatedExercise = {
      ...latestExerciseRef.current,
      notes,
    };

    latestExerciseRef.current = updatedExercise;
    return onExerciseUpdate(updatedExercise);
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

  const pendingPairSetKeys = useMemo(
    () =>
      exerciseSets
        .filter((set) => isPendingPairSet(set, isAuthenticated))
        .map(getExerciseSetClientKey),
    [exerciseSets, isAuthenticated],
  );

  return {
    addSet,
    addLeftRightPair,
    pendingPairSetKeys,
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
