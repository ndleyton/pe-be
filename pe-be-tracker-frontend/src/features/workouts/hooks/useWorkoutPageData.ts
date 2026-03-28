import { useCallback, useEffect, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";

import {
  getExercisesInWorkout,
  type Exercise,
} from "@/features/exercises/api";
import { getWorkoutById } from "@/features/workouts/api";
import {
  useAuthStore,
  useGuestStore,
  useUIStore,
  type GuestRoutine,
} from "@/stores";

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
    error.message.includes("Network Error") ||
    error.message.includes("Failed to fetch")
  );
};

type UseWorkoutPageDataArgs = {
  workoutId?: string;
  routine?: GuestRoutine;
  shouldScrollToBottomOnLoad: boolean;
  onPromptFinishWorkout: () => void;
};

export const useWorkoutPageData = ({
  workoutId,
  routine,
  shouldScrollToBottomOnLoad,
  onPromptFinishWorkout,
}: UseWorkoutPageDataArgs) => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const authLoading = useAuthStore((state) => state.loading);
  const guestHydrated = useGuestStore((state) => state.hydrated);
  const guestWorkout = useGuestStore((state) =>
    state.workouts.find((workout) => workout.id === workoutId),
  );
  const createExercisesFromRoutine = useGuestStore(
    (state) => state.createExercisesFromRoutine,
  );
  const syncWorkoutTimer = useUIStore((state) => state.syncWorkoutTimer);

  const exerciseListContainerRef = useRef<HTMLDivElement | null>(null);
  const didHandleRouteScrollRef = useRef(false);
  const previousExerciseCountRef = useRef<number | null>(null);

  const scrollExerciseListToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      const container = exerciseListContainerRef.current;
      if (!container) {
        return;
      }

      container.scrollTo({
        top: container.scrollHeight,
        behavior: "smooth",
      });
    });
  }, []);

  const {
    data: serverWorkout,
    error: workoutError,
    isPending: workoutPending,
    refetch: refetchWorkout,
    isFetching: workoutFetching,
  } = useQuery({
    queryKey: ["workout", workoutId],
    queryFn: () => getWorkoutById(workoutId as string),
    enabled: Boolean(workoutId) && isAuthenticated,
  });

  const {
    data: serverExercises,
    isLoading: exercisesLoading,
    error: exercisesError,
  } = useQuery({
    queryKey: ["exercises", workoutId],
    queryFn: () => getExercisesInWorkout(workoutId as string),
    enabled: Boolean(workoutId) && isAuthenticated,
  });

  const exercises = useMemo<Exercise[]>(
    () =>
      isAuthenticated
        ? Array.isArray(serverExercises)
          ? serverExercises
          : []
        : ((guestWorkout?.exercises ?? []) as unknown as Exercise[]),
    [guestWorkout?.exercises, isAuthenticated, serverExercises],
  );

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
    if (!routine || !workoutId || exercises.length > 0 || isAuthenticated) {
      return;
    }

    createExercisesFromRoutine(routine, workoutId);
  }, [
    createExercisesFromRoutine,
    exercises.length,
    isAuthenticated,
    routine,
    workoutId,
  ]);

  useEffect(() => {
    if (!shouldScrollToBottomOnLoad || didHandleRouteScrollRef.current) {
      return;
    }

    didHandleRouteScrollRef.current = true;
    scrollExerciseListToBottom();
  }, [scrollExerciseListToBottom, shouldScrollToBottomOnLoad]);

  useEffect(() => {
    const previousExerciseCount = previousExerciseCountRef.current;
    if (
      previousExerciseCount !== null &&
      exercises.length > previousExerciseCount
    ) {
      scrollExerciseListToBottom();
    }

    previousExerciseCountRef.current = exercises.length;
  }, [exercises.length, scrollExerciseListToBottom]);

  const workoutName = isAuthenticated
    ? (serverWorkout?.name ?? null)
    : (guestWorkout?.name ?? null);
  const workoutTypeId = isAuthenticated
    ? (serverWorkout?.workout_type_id ?? null)
    : (guestWorkout?.workout_type_id ?? null);
  const hasValidWorkout = isAuthenticated
    ? Boolean(serverWorkout)
    : guestHydrated && Boolean(guestWorkout);

  useEffect(() => {
    if (!hasValidWorkout) {
      return;
    }

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("popstate", onPromptFinishWorkout);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("popstate", onPromptFinishWorkout);
    };
  }, [hasValidWorkout, onPromptFinishWorkout]);

  const workoutErrorStatus = getErrorStatus(workoutError);
  const showNotFound =
    !workoutId ||
    (!isAuthenticated && guestHydrated && !guestWorkout) ||
    (isAuthenticated &&
      (workoutErrorStatus === 403 || workoutErrorStatus === 404));
  const showRecoverableWorkoutError =
    isAuthenticated && Boolean(workoutError) && !showNotFound;
  const recoveryMessage = isNetworkError(workoutError)
    ? "Check your connection and try again."
    : "This may be temporary. Try again or go back to your workouts.";

  const listPending =
    isAuthenticated && (authLoading || workoutPending || exercisesLoading);
  const listStatus: "pending" | "success" | "error" = listPending
    ? "pending"
    : isAuthenticated && exercisesError
      ? "error"
      : "success";

  return {
    authLoading,
    exerciseListContainerRef,
    exercises,
    isAuthenticated,
    listStatus,
    refetchWorkout,
    recoveryMessage,
    showNotFound,
    showRecoverableWorkoutError,
    workoutFetching,
    workoutName,
    workoutPending,
    workoutTypeId,
  };
};
