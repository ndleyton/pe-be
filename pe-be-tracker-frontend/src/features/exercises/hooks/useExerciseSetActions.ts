import { useEffect, useRef, useState } from "react";
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
  toGuestExerciseSets,
  type ExerciseRowProps,
} from "@/features/exercises/lib/exerciseRow";
import { useAuthStore, useGuestStore } from "@/stores";

type SetField = "weight" | "reps";

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
    exercise.exercise_sets || [],
  );

  useEffect(() => {
    setExerciseSets(exercise.exercise_sets || []);
  }, [exercise.exercise_sets]);

  const pendingUpdatesRef = useRef<
    Record<
      string,
      {
        timeout: ReturnType<typeof setTimeout>;
        data: UpdateExerciseSetData;
      }
    >
  >({});

  const publishExerciseUpdate = (nextExerciseSets: ExerciseSet[]) => {
    if (!onExerciseUpdate) {
      return;
    }

    onExerciseUpdate({
      ...exercise,
      exercise_sets: isAuthenticated
        ? nextExerciseSets
        : toGuestExerciseSets(nextExerciseSets),
    });
  };

  const invalidateExerciseQuery = () => {
    if (!workoutId) {
      return;
    }

    void queryClient.invalidateQueries({ queryKey: ["exercises", workoutId] });
  };

  useEffect(() => {
    return () => {
      Object.entries(pendingUpdatesRef.current).forEach(([setId, update]) => {
        clearTimeout(update.timeout);
        void updateExerciseSet(setId, update.data).catch((error) => {
          console.error("Failed to flush update on unmount:", error);
        });
      });
    };
  }, []);

  const setLocalExerciseSets = (nextExerciseSets: ExerciseSet[]) => {
    setExerciseSets(nextExerciseSets);
    publishExerciseUpdate(nextExerciseSets);
  };

  const queueSetUpdate = (
    setId: string | number,
    data: UpdateExerciseSetData,
  ) => {
    const key = String(setId);

    if (pendingUpdatesRef.current[key]) {
      clearTimeout(pendingUpdatesRef.current[key].timeout);
      pendingUpdatesRef.current[key].data = {
        ...pendingUpdatesRef.current[key].data,
        ...data,
      };
    } else {
      pendingUpdatesRef.current[key] = {
        timeout: setTimeout(() => undefined, 0),
        data,
      };
    }

    pendingUpdatesRef.current[key].timeout = setTimeout(async () => {
      try {
        const finalData = pendingUpdatesRef.current[key].data;
        await updateExerciseSet(setId, finalData);
      } catch (error) {
        console.error("Failed to update exercise set:", error);
        invalidateExerciseQuery();
      } finally {
        delete pendingUpdatesRef.current[key];
      }
    }, 500);
  };

  const updateSetField = (
    setId: string | number,
    field: SetField,
    value: number | null,
  ) => {
    const updatedSets = exerciseSets.map((set) =>
      String(set.id) === String(setId)
        ? {
            ...set,
            [field === "weight" ? "intensity" : "reps"]: value,
          }
        : set,
    );

    setLocalExerciseSets(updatedSets);

    if (!isAuthenticated) {
      return;
    }

    const updateData: UpdateExerciseSetData =
      field === "weight" ? { intensity: value } : { reps: value };

    queueSetUpdate(setId, updateData);
  };

  const incrementReps = (setId: string | number) => {
    const currentSet = exerciseSets.find((set) => String(set.id) === String(setId));
    const nextReps = (currentSet?.reps || 0) + 1;
    updateSetField(setId, "reps", nextReps);
  };

  const decrementReps = (setId: string | number) => {
    const currentSet = exerciseSets.find((set) => String(set.id) === String(setId));
    const nextReps = Math.max((currentSet?.reps || 0) - 1, 0);
    updateSetField(setId, "reps", nextReps);
  };

  const toggleSetCompletion = async (setId: string | number) => {
    const currentSet = exerciseSets.find((set) => String(set.id) === String(setId));
    if (!currentSet) {
      return;
    }

    const updatedSets = exerciseSets.map((set) =>
      String(set.id) === String(setId)
        ? {
            ...set,
            done: !set.done,
          }
        : set,
    );

    setLocalExerciseSets(updatedSets);

    if (!isAuthenticated) {
      return;
    }

    try {
      await updateExerciseSet(setId, { done: !currentSet.done });
    } catch (error) {
      console.error("Failed to toggle exercise set completion:", error);
      invalidateExerciseQuery();
    }
  };

  const updateSetNotes = async (setId: string | number, notes: string) => {
    const updatedSets = exerciseSets.map((set) =>
      String(set.id) === String(setId)
        ? {
            ...set,
            notes,
          }
        : set,
    );

    setLocalExerciseSets(updatedSets);

    if (!isAuthenticated) {
      return;
    }

    try {
      await updateExerciseSet(setId, { notes });
    } catch (error) {
      console.error("Failed to update exercise set notes:", error);
      invalidateExerciseQuery();
    }
  };

  const deleteSet = async (setId: string | number) => {
    const updatedSets = exerciseSets.filter(
      (set) => String(set.id) !== String(setId),
    );

    setLocalExerciseSets(updatedSets);

    if (!isAuthenticated) {
      return;
    }

    try {
      await deleteExerciseSet(setId);
    } catch (error) {
      console.error("Failed to delete exercise set:", error);
      invalidateExerciseQuery();
    }
  };

  const addSet = async (intensityUnitId: number) => {
    if (isUnsavedExercise) {
      return;
    }

    const lastSet = exerciseSets[exerciseSets.length - 1];
    const tempId = `temp-${Date.now()}`;
    const nextSetType = exerciseSets.length === 0 ? "warmup" : "working";
    const optimisticSet: ExerciseSet = {
      id: tempId,
      reps: lastSet?.reps,
      intensity: lastSet?.intensity,
      intensity_unit_id: intensityUnitId,
      exercise_id: exercise.id,
      rest_time_seconds: null,
      done: false,
      notes: null,
      type: nextSetType,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const updatedSets = [...exerciseSets, optimisticSet];
    setLocalExerciseSets(updatedSets);

    if (!isAuthenticated) {
      return;
    }

    try {
      const payload: CreateExerciseSetData = {
        reps: lastSet?.reps || 0,
        intensity: lastSet?.intensity || 0,
        intensity_unit_id: intensityUnitId,
        exercise_id: exercise.id,
        rest_time_seconds: 0,
        done: false,
        notes: undefined,
        type: nextSetType,
      };

      const createdSet = await createExerciseSet(payload);
      const finalUpdatedSets = updatedSets.map((set) =>
        String(set.id) === String(tempId) ? createdSet : set,
      );

      setLocalExerciseSets(finalUpdatedSets);
    } catch (error) {
      console.error("Failed to create exercise set:", error);
      invalidateExerciseQuery();
    }
  };

  const updateExerciseNotes = (notes: string) => {
    if (!onExerciseUpdate) {
      return;
    }

    onExerciseUpdate({
      ...exercise,
      notes,
    });
  };

  const handleExerciseDelete = async () => {
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
  };

  return {
    addSet,
    decrementReps,
    deleteSet,
    exerciseSets,
    handleExerciseDelete,
    incrementReps,
    isAuthenticated,
    isUnsavedExercise,
    toggleSetCompletion,
    updateExerciseNotes,
    updateSetField,
    updateSetNotes,
  };
};
