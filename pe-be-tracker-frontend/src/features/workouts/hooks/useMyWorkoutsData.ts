import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useGuestStore, useAuthStore } from "@/stores";
import { getMyWorkouts } from "../api";
import { type Workout } from "../types";
import { getCurrentUTCTimestamp } from "@/utils/date";

const getActiveWorkout = (workouts: Workout[]): Workout | null =>
  workouts.reduce<Workout | null>((activeWorkout, workout) => {
    if (workout.end_time) {
      return activeWorkout;
    }

    if (!activeWorkout) {
      return workout;
    }

    return new Date(workout.start_time).getTime()
      > new Date(activeWorkout.start_time).getTime()
      ? workout
      : activeWorkout;
  }, null);

export const useMyWorkoutsData = () => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const authLoading = useAuthStore((state) => state.loading);
  const authInitialized = useAuthStore((state) => state.initialized);
  const guestHydrated = useGuestStore((state) => state.hydrated);
  const guestWorkouts = useGuestStore((state) => state.workouts);

  const authResolved = authInitialized && !authLoading;

  const {
    data: serverWorkoutsResponse,
    isPending,
    status,
    error,
    refetch,
  } = useQuery({
    queryKey: ["workouts"],
    queryFn: () => getMyWorkouts(undefined, 100),
    enabled: authInitialized && !authLoading && isAuthenticated,
  });

  const workouts: Workout[] = useMemo(() => {
    if (!authResolved) {
      return [];
    }

    if (isAuthenticated) {
      return Array.isArray(serverWorkoutsResponse?.data)
        ? serverWorkoutsResponse.data
        : [];
    }

    return guestWorkouts.map((gw) => ({
      id: gw.id,
      name: gw.name,
      notes: gw.notes,
      start_time: gw.start_time,
      end_time: gw.end_time,
      workout_type_id: Number(gw.workout_type_id),
      created_at: gw.created_at || getCurrentUTCTimestamp(),
      updated_at: gw.updated_at || getCurrentUTCTimestamp(),
    }));
  }, [authResolved, isAuthenticated, serverWorkoutsResponse, guestWorkouts]);

  const isLoading =
    !authResolved || (isAuthenticated ? isPending : !guestHydrated);
  const hasLoadedWorkouts =
    authResolved && (isAuthenticated ? status === "success" : guestHydrated);
  const activeWorkout = useMemo(
    () => getActiveWorkout(workouts),
    [workouts],
  );

  return {
    workouts,
    activeWorkout,
    hasLoadedWorkouts,
    isLoading,
    error,
    refetch,
    isAuthenticated,
  };
};
