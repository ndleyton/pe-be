import type { Dispatch, SetStateAction } from "react";
import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  createExercise,
  type CreateExerciseData,
  type Exercise,
  type ExerciseType,
} from "@/features/exercises/api";
import { toGuestExerciseSets } from "@/features/exercises/lib/exerciseRow";
import { updateWorkout } from "@/features/workouts/api";
import type { Workout } from "@/features/workouts/types";
import {
  useGuestStore,
  type GuestExerciseType,
} from "@/stores";
import { getCurrentUTCTimestamp } from "@/utils/date";

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

type UseWorkoutExerciseActionsArgs = {
  isAuthenticated: boolean;
  setShowAddExerciseModal: Dispatch<SetStateAction<boolean>>;
  setShowFinishModal: Dispatch<SetStateAction<boolean>>;
  workoutId?: string;
};

export const useWorkoutExerciseActions = ({
  isAuthenticated,
  setShowAddExerciseModal,
  setShowFinishModal,
  workoutId,
}: UseWorkoutExerciseActionsArgs) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const addGuestExercise = useGuestStore((state) => state.addExercise);
  const deleteGuestExercise = useGuestStore((state) => state.deleteExercise);
  const updateGuestExercise = useGuestStore((state) => state.updateExercise);
  const updateGuestWorkout = useGuestStore((state) => state.updateWorkout);

  const deleteExerciseMutation = useMutation({
    mutationFn: async (_exerciseId: number | string) => undefined,
    onMutate: async (exerciseId) => {
      await queryClient.cancelQueries({ queryKey: ["exercises", workoutId] });
      const previousExercises = queryClient.getQueryData<Exercise[]>([
        "exercises",
        workoutId,
      ]);

      queryClient.setQueryData(
        ["exercises", workoutId],
        (currentExercises: Exercise[] | undefined) => {
          if (!currentExercises) {
            return currentExercises;
          }

          return currentExercises.filter(
            (exercise) => String(exercise.id) !== String(exerciseId),
          );
        },
      );

      return { previousExercises };
    },
    onError: (_error, _exerciseId, context) => {
      if (context?.previousExercises) {
        queryClient.setQueryData(
          ["exercises", workoutId],
          context.previousExercises,
        );
      }
    },
    onSettled: (_data, _error, exerciseId) => {
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

  const addExerciseMutation = useMutation({
    mutationFn: ({ data }: AddExercisePayload) => createExercise(data),
    onMutate: async ({ data, exerciseType }: AddExercisePayload) => {
      const exercisesQueryKey = ["exercises", workoutId] as const;
      await queryClient.cancelQueries({ queryKey: exercisesQueryKey });
      const previousExercises = queryClient.getQueryData<Exercise[]>(
        exercisesQueryKey,
      );
      const hadPreviousExercises = previousExercises !== undefined;
      const timestamp = new Date().toISOString();
      const optimisticId = `optimistic-${timestamp}-${exerciseType.id}`;
      const optimisticExercise: Exercise = {
        id: optimisticId,
        timestamp: data.timestamp ?? timestamp,
        notes: data.notes ?? null,
        exercise_type_id: data.exercise_type_id,
        workout_id: data.workout_id,
        created_at: timestamp,
        updated_at: timestamp,
        exercise_type: exerciseType,
        exercise_sets: [],
      };

      queryClient.setQueryData(
        exercisesQueryKey,
        (currentExercises: Exercise[] | undefined) =>
          currentExercises
            ? [...currentExercises, optimisticExercise]
            : [optimisticExercise],
      );

      return {
        prev: previousExercises,
        hadPrev: hadPreviousExercises,
        optimisticId,
        exerciseType,
      };
    },
    onError: (_error, _variables, context?: AddExerciseMutationContext) => {
      if (!context) {
        return;
      }

      const exercisesQueryKey = ["exercises", workoutId] as const;

      queryClient.setQueryData(
        exercisesQueryKey,
        (currentExercises: Exercise[] | undefined) =>
          currentExercises?.filter(
            (exercise) => String(exercise.id) !== String(context.optimisticId),
          ) ?? currentExercises,
      );

      if (context.hadPrev) {
        queryClient.setQueryData(exercisesQueryKey, context.prev);
        return;
      }

      const currentExercises = queryClient.getQueryData<Exercise[]>(
        exercisesQueryKey,
      );
      if (!currentExercises || currentExercises.length === 0) {
        queryClient.removeQueries({
          queryKey: exercisesQueryKey,
          exact: true,
        });
      }
    },
    onSuccess: (createdExercise, _variables, context) => {
      if (!context) {
        return;
      }

      const mergedExercise: Exercise = {
        ...createdExercise,
        exercise_type: createdExercise.exercise_type ?? context.exerciseType,
        exercise_sets: createdExercise.exercise_sets ?? [],
      };

      queryClient.setQueryData(
        ["exercises", workoutId],
        (currentExercises: Exercise[] | undefined) => {
          if (!currentExercises) {
            return [mergedExercise];
          }

          return currentExercises.map((exercise) =>
            String(exercise.id) === String(context.optimisticId)
              ? mergedExercise
              : exercise,
          );
        },
      );
    },
    onSettled: () => {
      if (!workoutId) {
        return;
      }

      queryClient.invalidateQueries({ queryKey: ["exercises", workoutId] });
    },
  });

  const finishWorkoutMutation = useMutation({
    mutationFn: (id: string) =>
      updateWorkout(id, {
        end_time: getCurrentUTCTimestamp(),
      }),
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
      setShowFinishModal(false);
      navigate("/workouts");
    },
    onError: (error) => {
      console.error("Failed to finish workout:", error);
      setShowFinishModal(false);
    },
  });

  const handleExerciseDelete = useCallback(
    (exerciseId: number | string) => {
      if (isAuthenticated) {
        deleteExerciseMutation.mutate(exerciseId);
        return;
      }

      deleteGuestExercise(String(exerciseId));
    },
    [deleteExerciseMutation, deleteGuestExercise, isAuthenticated],
  );

  const handleSelectExerciseType = useCallback(
    (exerciseType: ExerciseType | GuestExerciseType) => {
      setShowAddExerciseModal(false);
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

      addGuestExercise({
        exercise_type_id: String(exerciseType.id),
        workout_id: String(workoutId),
        timestamp,
        notes: null,
        exercise_type: exerciseType as GuestExerciseType,
      });
    },
    [addExerciseMutation, addGuestExercise, isAuthenticated, setShowAddExerciseModal, workoutId],
  );

  const handleExerciseUpdate = useCallback(
    (
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
          (currentExercises: Exercise[] | undefined) => {
            if (!currentExercises) {
              return currentExercises;
            }

            return currentExercises.map((exercise) =>
              exercise.id === updatedExercise.id ? updatedExercise : exercise,
            );
          },
        );
        return;
      }

      updateGuestExercise(String(updatedExercise.id), {
        exercise_sets: toGuestExerciseSets(updatedExercise.exercise_sets),
      });
    },
    [isAuthenticated, queryClient, updateGuestExercise, workoutId],
  );

  const handleFinishWorkout = useCallback(() => {
    if (!workoutId) {
      console.error("No workoutId available");
      return;
    }

    if (isAuthenticated) {
      finishWorkoutMutation.mutate(workoutId);
      return;
    }

    updateGuestWorkout(workoutId, {
      end_time: getCurrentUTCTimestamp(),
    });
    setShowFinishModal(false);
    navigate("/workouts");
  }, [
    finishWorkoutMutation,
    isAuthenticated,
    navigate,
    setShowFinishModal,
    updateGuestWorkout,
    workoutId,
  ]);

  return {
    handleExerciseDelete,
    handleExerciseUpdate,
    handleFinishWorkout,
    handleSelectExerciseType,
    isAddingExercise: isAuthenticated && addExerciseMutation.isPending,
    isFinishingWorkout: isAuthenticated && finishWorkoutMutation.isPending,
  };
};
