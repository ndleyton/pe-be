import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import api from "@/shared/api/client";
import { endpoints } from "@/shared/api/endpoints";
import {
  getExercisesInWorkout,
  type Exercise,
} from "@/features/exercises/api";
import { normalizeExerciseClientKeys } from "@/features/exercises/lib/exerciseRow";
import type { Routine } from "@/features/routines/types";
import { useAuthStore, useGuestStore, useUIStore } from "@/stores";
import type { Workout } from "../types";

const MAX_EXERCISE_IMAGE_PRELOADS = 4;

export interface WorkoutPageLocationState {
  routine?: Routine;
  scrollToBottomOnLoad?: boolean;
  knownEmptyExercises?: boolean;
}

const getErrorStatus = (error: unknown): number | null => {
  if (typeof error !== "object" || error === null || !("response" in error)) {
    return null;
  }

  const response = (error as { response?: { status?: unknown } }).response;
  return typeof response?.status === "number" ? response.status : null;
};

const isNetworkError = (error: unknown): boolean => {
  if (!(error instanceof Error)) {
    return false;
  }

  return (
    error.message.includes("Network Error")
    || error.message.includes("Failed to fetch")
  );
};

const fetchWorkout = async (workoutId: string): Promise<Workout> => {
  const response = await api.get(endpoints.workoutById(workoutId));
  return response.data as Workout;
};

export const useWorkoutPageData = ({
  pathname,
  routeState,
  workoutId,
}: {
  pathname: string;
  routeState: WorkoutPageLocationState | null;
  workoutId: string | undefined;
}) => {
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const authInitialized = useAuthStore((state) => state.initialized);
  const guestHydrated = useGuestStore((state) => state.hydrated);
  const guestWorkout = useGuestStore((state) =>
    state.workouts.find((workout) => workout.id === workoutId),
  );
  const guestCreateExercisesFromRoutine = useGuestStore(
    (state) => state.createExercisesFromRoutine,
  );
  const syncWorkoutTimer = useUIStore((state) => state.syncWorkoutTimer);

  const routine = routeState?.routine;
  const shouldScrollToBottomOnLoad = Boolean(routeState?.scrollToBottomOnLoad);

  const [knownEmptyExercisesLatched, setKnownEmptyExercisesLatched] = useState(
    () => Boolean(routeState?.knownEmptyExercises),
  );
  const preloadedExerciseImagesRef = useRef<Set<string>>(new Set());
  const previousExercisesRef = useRef<Exercise[]>([]);

  const {
    data: serverWorkout,
    error: workoutError,
    isPending: workoutPending,
    refetch: refetchWorkout,
    isFetching: workoutFetching,
  } = useQuery({
    queryKey: ["workout", workoutId],
    queryFn: () => fetchWorkout(workoutId as string),
    enabled: !!workoutId && isAuthenticated,
  });

  const {
    data: serverExercises,
    isLoading: exercisesLoading,
    error: exercisesError,
  } = useQuery({
    queryKey: ["exercises", workoutId],
    queryFn: () => getExercisesInWorkout(workoutId as string),
    enabled: !!workoutId && isAuthenticated,
  });

  const exercises: Exercise[] = useMemo(() => {
    return isAuthenticated
      ? Array.isArray(serverExercises)
        ? normalizeExerciseClientKeys(
            serverExercises,
            previousExercisesRef.current,
          )
        : []
      : normalizeExerciseClientKeys(
          (guestWorkout?.exercises ?? []) as unknown as Exercise[],
          previousExercisesRef.current,
        );
  }, [guestWorkout?.exercises, isAuthenticated, serverExercises]);

  useEffect(() => {
    previousExercisesRef.current = exercises;
  }, [exercises]);

  useEffect(() => {
    const imageUrls = exercises
      .slice(0, MAX_EXERCISE_IMAGE_PRELOADS)
      .map((exercise) => exercise.exercise_type.images?.[0])
      .filter((imageUrl): imageUrl is string => Boolean(imageUrl))
      .filter((imageUrl) => !preloadedExerciseImagesRef.current.has(imageUrl));

    if (imageUrls.length === 0) {
      return;
    }

    let cancelled = false;
    const browserWindow = window as Window &
      typeof globalThis & {
        requestIdleCallback?: (
          callback: IdleRequestCallback,
          options?: IdleRequestOptions,
        ) => number;
        cancelIdleCallback?: (handle: number) => void;
      };

    const preloadImages = () => {
      if (cancelled) {
        return;
      }

      imageUrls.forEach((imageUrl) => {
        const img = new window.Image();
        img.src = imageUrl;
        preloadedExerciseImagesRef.current.add(imageUrl);
      });
    };

    if (typeof browserWindow.requestIdleCallback === "function") {
      const idleId = browserWindow.requestIdleCallback(preloadImages, {
        timeout: 1500,
      });

      return () => {
        cancelled = true;
        browserWindow.cancelIdleCallback?.(idleId);
      };
    }

    const timeoutId = window.setTimeout(preloadImages, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [exercises]);

  useEffect(() => {
    if (isAuthenticated) {
      if (!serverWorkout) {
        return;
      }

      syncWorkoutTimer({
        id: serverWorkout.id,
        startTime: serverWorkout.start_time,
        endTime: serverWorkout.end_time,
      });
      return;
    }

    if (!guestHydrated || !guestWorkout) {
      return;
    }

    syncWorkoutTimer({
      id: guestWorkout.id,
      startTime: guestWorkout.start_time,
      endTime: guestWorkout.end_time,
    });
  }, [
    guestHydrated,
    guestWorkout,
    isAuthenticated,
    serverWorkout,
    syncWorkoutTimer,
  ]);

  useEffect(() => {
    if (
      !routine
      || !workoutId
      || exercises.length !== 0
      || isAuthenticated
      || !guestHydrated
      || !guestWorkout
    ) {
      return;
    }

    guestCreateExercisesFromRoutine(routine, workoutId);
  }, [
    exercises.length,
    guestCreateExercisesFromRoutine,
    guestHydrated,
    guestWorkout,
    isAuthenticated,
    routine,
    workoutId,
  ]);

  useEffect(() => {
    if (!routeState?.knownEmptyExercises) {
      return;
    }

    setKnownEmptyExercisesLatched(true);

    const { knownEmptyExercises: _ignored, ...restState } = routeState;
    navigate(pathname, {
      replace: true,
      state: Object.keys(restState).length > 0 ? restState : null,
    });
  }, [navigate, pathname, routeState]);

  useEffect(() => {
    if (
      knownEmptyExercisesLatched
      && isAuthenticated
      && !exercisesLoading
    ) {
      setKnownEmptyExercisesLatched(false);
    }
  }, [exercisesLoading, isAuthenticated, knownEmptyExercisesLatched]);

  const workoutName = isAuthenticated
    ? (serverWorkout?.name ?? null)
    : (guestWorkout?.name ?? null);
  const workoutEndTime = isAuthenticated
    ? (serverWorkout?.end_time ?? null)
    : (guestWorkout?.end_time ?? null);
  const workoutTypeId = isAuthenticated
    ? (serverWorkout?.workout_type_id ?? null)
    : (guestWorkout?.workout_type_id ?? null);
  const hasValidWorkout = isAuthenticated
    ? Boolean(serverWorkout)
    : guestHydrated && Boolean(guestWorkout);

  const workoutErrorStatus = getErrorStatus(workoutError);
  const pagePending = !authInitialized || (isAuthenticated && workoutPending);
  const showNotFound = !workoutId
    || (authInitialized && !isAuthenticated && guestHydrated && !guestWorkout)
    || (isAuthenticated
      && (workoutErrorStatus === 403 || workoutErrorStatus === 404));
  const showRecoverableWorkoutError =
    isAuthenticated && Boolean(workoutError) && !showNotFound;
  const listPending =
    pagePending
    || (isAuthenticated && exercisesLoading && !knownEmptyExercisesLatched);
  const listStatus: "pending" | "success" | "error" = listPending
    ? "pending"
    : isAuthenticated && exercisesError
      ? "error"
      : "success";
  const showLoadingTitle = pagePending && !workoutName;
  const recoveryMessage = isNetworkError(workoutError)
    ? "Check your connection and try again."
    : "This may be temporary. Try again or go back to your workouts.";

  return {
    exercises,
    hasValidWorkout,
    isAuthenticated,
    listStatus,
    recoveryMessage,
    refetchWorkout,
    routine,
    serverWorkout,
    shouldScrollToBottomOnLoad,
    showLoadingTitle,
    showNotFound,
    showRecoverableWorkoutError,
    workoutEndTime,
    workoutFetching,
    workoutId,
    workoutName,
    workoutTypeId,
  };
};
