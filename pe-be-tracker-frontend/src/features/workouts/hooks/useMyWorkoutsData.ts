import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useGuestStore, useAuthStore } from "@/stores";
import { getMyWorkouts, type Workout } from "../api";
import { getCurrentUTCTimestamp } from "@/utils/date";

export const useMyWorkoutsData = () => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const authLoading = useAuthStore((state) => state.loading);
  const authInitialized = useAuthStore((state) => state.initialized);
  const guestData = useGuestStore();
  const guestHydrated = useGuestStore((state) => state.hydrated);

  const authResolved = authInitialized && !authLoading;

  const {
    data: serverWorkoutsResponse,
    isPending,
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

    const guestWorkouts = Array.isArray(guestData?.workouts)
      ? guestData.workouts
      : [];

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
  }, [authResolved, isAuthenticated, serverWorkoutsResponse, guestData?.workouts]);

  const isLoading =
    !authResolved || (isAuthenticated ? isPending : !guestHydrated);

  return {
    workouts,
    isLoading,
    error,
    refetch,
    isAuthenticated,
  };
};
