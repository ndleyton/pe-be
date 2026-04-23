import { useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import api from "@/shared/api/client";
import { endpoints } from "@/shared/api/endpoints";
import {
  createExercise,
  getExerciseTypes,
  type CreateExerciseData,
  type Exercise,
  type ExerciseType,
} from "@/features/exercises/api";
import { EXERCISE_TYPE_MODAL_INITIAL_LIMIT } from "@/features/exercises/constants";
import type { Workout } from "@/features/workouts/types";
import { useGuestStore } from "@/stores";
import type { GuestExerciseType } from "@/stores";
import { getCurrentUTCTimestamp } from "@/utils/date";
import { createIntentPreload } from "@/shared/lib/createIntentPreload";

const preloadExerciseTypeModal = createIntentPreload(() =>
  import("@/features/exercises/components/ExerciseTypeModal/ExerciseTypeModal"),
);

const updateWorkoutEndTime = async (workoutId: string) => {
  const response = await api.patch(endpoints.workoutById(workoutId), {
    end_time: getCurrentUTCTimestamp(),
  });
  return response.data;
};

type AddExercisePayload = {
  data: CreateExerciseData;
  exerciseType: ExerciseType;
};

type AddExerciseMutationContext = {
  prev?: Exercise[];
  hadPrev: boolean;
  optimisticId: string;
  exerciseType: ExerciseType;
};

export const useWorkoutExerciseActions = ({
  exercises,
  isAuthenticated,
  onFinishModalClose,
  serverWorkout,
  showFinishModal,
  workoutId,
}: {
  exercises: Exercise[];
  isAuthenticated: boolean;
  onFinishModalClose: () => void;
  serverWorkout: Workout | undefined;
  showFinishModal: boolean;
  workoutId: string | undefined;
}) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const guestAddExercise = useGuestStore((state) => state.addExercise);
  const guestDeleteExercise = useGuestStore((state) => state.deleteExercise);
  const guestUpdateExercise = useGuestStore((state) => state.updateExercise);
  const guestUpdateWorkout = useGuestStore((state) => state.updateWorkout);

  const deleteExerciseMutation = useMutation({
    mutationFn: async (_exerciseId: number | string) => {
      return;
    },
    onMutate: async (exerciseId) => {
      await queryClient.cancelQueries({ queryKey: ["exercises", workoutId] });
      const prev = queryClient.getQueryData<Exercise[]>([
        "exercises",
        workoutId,
      ]);
      queryClient.setQueryData(
        ["exercises", workoutId],
        (old: Exercise[] | undefined) => {
          if (!old) {
            return old;
          }

          return old.filter((exercise) =>
            String(exercise.id) !== String(exerciseId)
          );
        },
      );
      return { prev };
    },
    onError: (_err, _exerciseId, ctx) => {
      if (ctx?.prev) {
        queryClient.setQueryData(["exercises", workoutId], ctx.prev);
      }
    },
    onSettled: (_data, _err, exerciseId) => {
      queryClient.invalidateQueries({ queryKey: ["exercises", workoutId] });
      queryClient.removeQueries({
        queryKey: ["exercise", exerciseId],
        exact: true,
      });
      queryClient.removeQueries({
        queryKey: ["exerciseSets", "byExercise", exerciseId],
      });
    },
  });

  const finishWorkoutMutation = useMutation({
    mutationFn: (id: string) => updateWorkoutEndTime(id),
    onSuccess: (updatedWorkout, id) => {
      queryClient.setQueryData(["workout", id], updatedWorkout);
      queryClient.setQueryData(
        ["workouts"],
        (
          current:
            | { data: Workout[]; next_cursor?: number | null }
            | undefined,
        ) => {
          if (!current?.data) {
            return current;
          }

          return {
            ...current,
            data: current.data.map((workout) =>
              String(workout.id) === String(updatedWorkout.id)
                ? updatedWorkout
                : workout,
            ),
          };
        },
      );
      queryClient.invalidateQueries({ queryKey: ["workouts"] });
      onFinishModalClose();
      navigate("/workouts");
    },
    onError: (error) => {
      console.error("Failed to finish workout:", error);
      onFinishModalClose();
    },
  });

  const generateRecapMutation = useMutation({
    mutationFn: (id: string) => api.post(endpoints.workoutRecap(id)),
    onSuccess: (response, id) => {
      queryClient.setQueryData(["workout", id], response.data);
    },
  });

  useEffect(() => {
    if (
      showFinishModal
      && workoutId
      && isAuthenticated
      && exercises.length > 0
      && !serverWorkout?.recap
      && !generateRecapMutation.isPending
      && !generateRecapMutation.isSuccess
    ) {
      generateRecapMutation.mutate(workoutId);
    }
  }, [
    exercises.length,
    generateRecapMutation.isPending,
    generateRecapMutation.isSuccess,
    isAuthenticated,
    serverWorkout?.recap,
    showFinishModal,
    workoutId,
  ]);

  const addExerciseMutation = useMutation({
    mutationFn: ({ data }: AddExercisePayload) => createExercise(data),
    onMutate: async ({ data, exerciseType }: AddExercisePayload) => {
      const exercisesQueryKey = ["exercises", workoutId] as const;
      await queryClient.cancelQueries({ queryKey: ["exercises", workoutId] });
      const prev = queryClient.getQueryData<Exercise[]>(exercisesQueryKey);
      const hadPrev = prev !== undefined;
      const now = new Date().toISOString();
      const optimisticId = `optimistic-${now}-${exerciseType.id}`;
      const optimisticExercise: Exercise = {
        id: optimisticId,
        timestamp: data.timestamp ?? now,
        notes: data.notes ?? null,
        exercise_type_id: data.exercise_type_id,
        workout_id: data.workout_id,
        created_at: now,
        updated_at: now,
        exercise_type: exerciseType,
        exercise_sets: [],
      };

      queryClient.setQueryData(
        exercisesQueryKey,
        (old: Exercise[] | undefined) =>
          old ? [...old, optimisticExercise] : [optimisticExercise],
      );

      return { prev, hadPrev, optimisticId, exerciseType };
    },
    onError: (_err, _vars, ctx?: AddExerciseMutationContext) => {
      if (!ctx) {
        return;
      }

      const exercisesQueryKey = ["exercises", workoutId] as const;

      queryClient.setQueryData(
        exercisesQueryKey,
        (old: Exercise[] | undefined) =>
          old?.filter(
            (exercise) => String(exercise.id) !== String(ctx.optimisticId),
          ) ?? old,
      );

      if (ctx.hadPrev) {
        queryClient.setQueryData(exercisesQueryKey, ctx.prev);
      } else {
        const current = queryClient.getQueryData<Exercise[]>(exercisesQueryKey);
        if (!current || current.length === 0) {
          queryClient.removeQueries({
            queryKey: exercisesQueryKey,
            exact: true,
          });
        }
      }
    },
    onSuccess: (createdExercise, _vars, ctx) => {
      if (!ctx) {
        return;
      }

      const mergedExercise: Exercise = {
        ...createdExercise,
        exercise_type: createdExercise.exercise_type ?? ctx.exerciseType,
        exercise_sets: createdExercise.exercise_sets ?? [],
      };

      queryClient.setQueryData(
        ["exercises", workoutId],
        (old: Exercise[] | undefined) => {
          if (!old) {
            return [mergedExercise];
          }

          return old.map((exercise) =>
            String(exercise.id) === String(ctx.optimisticId)
              ? mergedExercise
              : exercise,
          );
        },
      );
    },
    onSettled: () => {
      if (workoutId) {
        queryClient.invalidateQueries({ queryKey: ["exercises", workoutId] });
      }
    },
  });

  const handleExerciseDelete = useCallback((exerciseId: number | string) => {
    if (isAuthenticated) {
      deleteExerciseMutation.mutate(exerciseId);
      return;
    }

    guestDeleteExercise(String(exerciseId));
  }, [deleteExerciseMutation, guestDeleteExercise, isAuthenticated]);

  const handleRegenerateRecap = useCallback(() => {
    if (workoutId && isAuthenticated) {
      generateRecapMutation.mutate(workoutId);
    }
  }, [generateRecapMutation, isAuthenticated, workoutId]);

  const handleSelectExerciseType = useCallback((
    exerciseType: ExerciseType | GuestExerciseType,
  ) => {
    if (!workoutId) {
      return;
    }

    const timestamp = new Date().toISOString();

    if (isAuthenticated) {
      addExerciseMutation.mutate({
        data: {
          exercise_type_id: Number(exerciseType.id),
          workout_id: Number(workoutId),
          timestamp,
          notes: null,
        },
        exerciseType: exerciseType as ExerciseType,
      });
      return;
    }

    const guestType = exerciseType as GuestExerciseType;
    guestAddExercise({
      exercise_type_id: String(guestType.id),
      workout_id: String(workoutId),
      timestamp,
      notes: null,
      exercise_type: guestType,
    });
  }, [addExerciseMutation, guestAddExercise, isAuthenticated, workoutId]);

  const handleExerciseUpdate = useCallback((
    updatedExercise: Exercise,
    shouldInvalidateQuery: boolean = false,
  ) => {
    if (isAuthenticated && shouldInvalidateQuery) {
      queryClient.invalidateQueries({ queryKey: ["exercises", workoutId] });
      return;
    }

    if (isAuthenticated) {
      queryClient.setQueryData(
        ["exercises", workoutId],
        (oldData: Exercise[] | undefined) => {
          if (!oldData) {
            return oldData;
          }

          return oldData.map((exercise) =>
            exercise.id === updatedExercise.id ? updatedExercise : exercise,
          );
        },
      );
      return;
    }

    const guestExerciseSets = updatedExercise.exercise_sets.map((set) => ({
      ...set,
      id: String(set.id),
      exercise_id: String(set.exercise_id),
    }));

    guestUpdateExercise(String(updatedExercise.id), {
      exercise_sets: guestExerciseSets,
    });
  }, [guestUpdateExercise, isAuthenticated, queryClient, workoutId]);

  const handleFinishWorkout = useCallback(() => {
    if (!workoutId) {
      console.error("No workoutId available");
      return;
    }

    if (isAuthenticated) {
      finishWorkoutMutation.mutate(workoutId);
      return;
    }

    guestUpdateWorkout(workoutId, {
      end_time: getCurrentUTCTimestamp(),
    });
    onFinishModalClose();
    navigate("/workouts");
  }, [
    finishWorkoutMutation,
    guestUpdateWorkout,
    isAuthenticated,
    navigate,
    onFinishModalClose,
    workoutId,
  ]);

  const warmExerciseTypeModal = useCallback(() => {
    preloadExerciseTypeModal();

    if (!isAuthenticated) {
      return;
    }

    void queryClient.prefetchInfiniteQuery({
      queryKey: ["exerciseTypes", "modal", "usage"],
      queryFn: ({ pageParam }) =>
        getExerciseTypes(
          "usage",
          pageParam as number | undefined,
          EXERCISE_TYPE_MODAL_INITIAL_LIMIT,
        ),
      getNextPageParam: (lastPage: { next_cursor?: number | null }) =>
        lastPage?.next_cursor ?? undefined,
      initialPageParam: undefined as number | undefined,
    });
  }, [isAuthenticated, queryClient]);

  return {
    addExerciseMutation,
    finishWorkoutMutation,
    generateRecapMutation,
    handleExerciseDelete,
    handleExerciseUpdate,
    handleFinishWorkout,
    handleRegenerateRecap,
    handleSelectExerciseType,
    warmExerciseTypeModal,
  };
};
