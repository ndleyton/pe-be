import { useMemo, useRef } from "react";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { useGuestStore, useAuthStore } from "@/stores";
import { getMyWorkouts } from "../api";
import { type Workout } from "../types";
import { getCurrentUTCTimestamp } from "@/utils/date";

const WORKOUTS_PAGE_SIZE = 25;

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
  const authInitialized = useAuthStore((state) => state.initialized);
  const hasSessionHint = useAuthStore((state) => Boolean(state.hasSessionHint));
  const guestHydrated = useGuestStore((state) => state.hydrated);
  const guestWorkouts = useGuestStore((state) => state.workouts);

  const assumeAuthenticated = authInitialized ? isAuthenticated : hasSessionHint;
  const queryClient = useQueryClient();
  const sequenceCursorsRef = useRef<Set<number> | null>(null);

  const {
    data: serverWorkoutsResponse,
    isPending,
    status,
    error,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ["workouts"],
    queryFn: async ({ pageParam }) => {
      const cursor = pageParam as number | undefined;
      if (cursor === undefined || cursor === null) {
        sequenceCursorsRef.current = new Set<number>();
        return getMyWorkouts(undefined, WORKOUTS_PAGE_SIZE);
      }

      if (sequenceCursorsRef.current === null) {
        const cachedData = queryClient.getQueryData<{
          pageParams?: Array<number | undefined>;
        }>(["workouts"]);
        const initialCursors = new Set<number>();
        if (Array.isArray(cachedData?.pageParams)) {
          for (const param of cachedData.pageParams) {
            if (typeof param === "number") {
              initialCursors.add(param);
            }
          }
        }
        sequenceCursorsRef.current = initialCursors;
      }

      if (sequenceCursorsRef.current.has(cursor)) {
        throw new Error(
          `Workouts pagination returned repeated cursor ${cursor}`,
        );
      }

      const response = await getMyWorkouts(cursor, WORKOUTS_PAGE_SIZE);
      sequenceCursorsRef.current.add(cursor);
      return response;
    },
    initialPageParam: undefined as number | undefined,
    getNextPageParam: (lastPage) => lastPage.next_cursor ?? undefined,
    enabled: assumeAuthenticated,
    retry: (failureCount, queryError) => {
      if (
        axios.isAxiosError(queryError) &&
        (queryError.response?.status === 401 ||
          queryError.response?.status === 403)
      ) {
        return false;
      }
      const defaultRetry = queryClient.getDefaultOptions().queries?.retry;
      if (defaultRetry === false) {
        return false;
      }
      if (typeof defaultRetry === "number") {
        return failureCount < defaultRetry;
      }
      return failureCount < 1;
    },
  });

  const workouts: Workout[] = useMemo(() => {
    if (assumeAuthenticated) {
      if (!serverWorkoutsResponse?.pages) {
        return [];
      }
      return serverWorkoutsResponse.pages.flatMap((page) =>
        Array.isArray(page?.data) ? page.data : []
      );
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
  }, [assumeAuthenticated, serverWorkoutsResponse, guestWorkouts]);

  const isLoading = assumeAuthenticated ? isPending : !guestHydrated;
  const hasLoadedWorkouts = assumeAuthenticated
    ? status === "success"
    : guestHydrated;
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
    fetchNextPage,
    hasNextPage: !!hasNextPage,
    isFetchingNextPage,
  };
};
