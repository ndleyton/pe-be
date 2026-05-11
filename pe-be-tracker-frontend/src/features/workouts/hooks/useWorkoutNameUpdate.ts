import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { updateWorkout } from "@/features/workouts/api";
import type { Workout } from "@/features/workouts/types";
import { useGuestStore } from "@/stores";

type WorkoutsResponse = {
  data: Workout[];
  next_cursor?: number | null;
};

type WorkoutNameUpdateContext = {
  previousWorkout?: Workout;
  previousWorkouts?: WorkoutsResponse;
};

export const useWorkoutNameUpdate = ({
  isAuthenticated,
  workoutId,
}: {
  isAuthenticated: boolean;
  workoutId: string | undefined;
}) => {
  const queryClient = useQueryClient();
  const guestUpdateWorkout = useGuestStore((state) => state.updateWorkout);

  return useMutation<
    Workout | null,
    Error,
    string | null,
    WorkoutNameUpdateContext
  >({
    mutationFn: async (name) => {
      if (!workoutId) {
        throw new Error("Workout id is required.");
      }

      if (!isAuthenticated) {
        guestUpdateWorkout(workoutId, { name });
        return null;
      }

      return updateWorkout(workoutId, { name });
    },
    onMutate: async (name) => {
      if (!workoutId || !isAuthenticated) {
        return {};
      }

      const workoutQueryKey = ["workout", workoutId] as const;
      const workoutsQueryKey = ["workouts"] as const;

      await Promise.all([
        queryClient.cancelQueries({ queryKey: workoutQueryKey }),
        queryClient.cancelQueries({ queryKey: workoutsQueryKey }),
      ]);

      const previousWorkout =
        queryClient.getQueryData<Workout>(workoutQueryKey);
      const previousWorkouts =
        queryClient.getQueryData<WorkoutsResponse>(workoutsQueryKey);
      const updatedAt = new Date().toISOString();

      queryClient.setQueryData<Workout | undefined>(
        workoutQueryKey,
        (current) =>
          current ? { ...current, name, updated_at: updatedAt } : current,
      );
      queryClient.setQueryData<WorkoutsResponse | undefined>(
        workoutsQueryKey,
        (current) => {
          if (!current?.data) {
            return current;
          }

          return {
            ...current,
            data: current.data.map((workout) =>
              String(workout.id) === String(workoutId)
                ? { ...workout, name, updated_at: updatedAt }
                : workout,
            ),
          };
        },
      );

      return { previousWorkout, previousWorkouts };
    },
    onError: (_error, _name, context) => {
      if (workoutId && isAuthenticated) {
        if (context?.previousWorkout) {
          queryClient.setQueryData(
            ["workout", workoutId],
            context.previousWorkout,
          );
        }
        if (context?.previousWorkouts) {
          queryClient.setQueryData(["workouts"], context.previousWorkouts);
        }
      }

      toast.error("Could not update workout name.");
    },
    onSuccess: (updatedWorkout) => {
      if (!workoutId || !updatedWorkout) {
        return;
      }

      queryClient.setQueryData(["workout", workoutId], updatedWorkout);
      queryClient.setQueryData<WorkoutsResponse | undefined>(
        ["workouts"],
        (current) => {
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
    },
    onSettled: () => {
      if (isAuthenticated) {
        queryClient.invalidateQueries({ queryKey: ["workouts"] });
      }
    },
  });
};
