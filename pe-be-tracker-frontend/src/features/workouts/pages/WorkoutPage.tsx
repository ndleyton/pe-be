import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useNavigate, useLocation, Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@/shared/api/client";
import {
  getExercisesInWorkout,
  Exercise,
  type ExerciseType,
  createExercise,
  type CreateExerciseData,
} from "@/features/exercises/api";
import { ExerciseList, ExerciseTypeModal } from "@/features/exercises/components";
import { FinishWorkoutModal } from "@/features/workouts/components";
import { type Workout } from "@/features/workouts/types";
import type { Routine } from "@/features/routines/types";
import { Button } from "@/shared/components/ui/button";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { endpoints } from "@/shared/api/endpoints";
import { ArrowLeft } from "lucide-react";
import { SaveRoutineModal } from "@/features/routines/components/SaveRoutineModal/SaveRoutineModal";
import FloatingActionButton from "@/shared/components/FloatingActionButton";
import {
  useGuestStore,
  useAuthStore,
  useUIStore,
  GuestExerciseType,
} from "@/stores";
import { getCurrentUTCTimestamp } from "@/utils/date";
import NotFoundPage from "@/pages/NotFoundPage";

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

const updateWorkoutEndTime = async (workoutId: string) => {
  const response = await api.patch(endpoints.workoutById(workoutId), {
    end_time: getCurrentUTCTimestamp(),
  });
  return response.data;
};

// Fetch a single workout by ID (for authenticated users)
const fetchWorkout = async (workoutId: string): Promise<Workout> => {
  const response = await api.get(endpoints.workoutById(workoutId));
  return response.data as Workout;
};

const WorkoutPage = () => {
  const { workoutId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();

  // Get state from stores
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const authInitialized = useAuthStore((state) => state.initialized);
  const guestHydrated = useGuestStore((state) => state.hydrated);
  const guestWorkout = useGuestStore((state) =>
    state.workouts.find((workout) => workout.id === workoutId),
  );
  const guestAddExercise = useGuestStore((state) => state.addExercise);
  const guestCreateExercisesFromRoutine = useGuestStore(
    (state) => state.createExercisesFromRoutine,
  );
  const guestDeleteExercise = useGuestStore((state) => state.deleteExercise);
  const guestUpdateExercise = useGuestStore((state) => state.updateExercise);
  const guestUpdateWorkout = useGuestStore((state) => state.updateWorkout);

  // Get workout timer state and actions from UI store
  const syncWorkoutTimer = useUIStore((state) => state.syncWorkoutTimer);

  const [showFinishModal, setShowFinishModal] = useState(false);
  const [showSaveRoutineModal, setShowSaveRoutineModal] = useState(false);
  const [showAddExerciseModal, setShowAddExerciseModal] = useState(false);
  const exerciseListContainerRef = useRef<HTMLDivElement | null>(null);
  const didHandleRouteScrollRef = useRef(false);
  const previousExerciseCountRef = useRef<number | null>(null);

  const routine = location.state?.routine as Routine | undefined;
  const shouldScrollToBottomOnLoad = Boolean(
    location.state?.scrollToBottomOnLoad,
  );

  const scrollExerciseListToBottom = () => {
    requestAnimationFrame(() => {
      const container = exerciseListContainerRef.current;
      if (!container) return;
      container.scrollTo({
        top: container.scrollHeight,
        behavior: "smooth",
      });
    });
  };

  // Fetch workout details (only when authenticated)
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

  const deleteExerciseMutation = useMutation({
    // request is done in ExerciseRow. This mutation
    // only updates cache optimistically and handles invalidation.
    mutationFn: async (_exerciseId: number | string) => {
      return;
    },
    onMutate: async (exerciseId) => {
      await queryClient.cancelQueries({ queryKey: ["exercises", workoutId] });
      const prev = queryClient.getQueryData<Exercise[]>([
        "exercises",
        workoutId,
      ]);
      // Optimistically remove from list
      queryClient.setQueryData(
        ["exercises", workoutId],
        (old: Exercise[] | undefined) => {
          if (!old) return old;
          return old.filter((e) => String(e.id) !== String(exerciseId));
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
      // Clean up potential detail caches (if any exist)
      queryClient.removeQueries({
        queryKey: ["exercise", exerciseId],
        exact: true,
      });
      queryClient.removeQueries({
        queryKey: ["exerciseSets", "byExercise", exerciseId],
      });
    },
  });

  const handleExerciseDelete = useCallback((exerciseId: number | string) => {
    if (isAuthenticated) {
      deleteExerciseMutation.mutate(exerciseId);
    } else {
      guestDeleteExercise(String(exerciseId));
    }
  }, [deleteExerciseMutation, guestDeleteExercise, isAuthenticated]);

  // Fetch exercises for this workout (only when authenticated)
  const {
    data: serverExercises,
    isLoading: exercisesLoading,
    error: exercisesError,
  } = useQuery({
    queryKey: ["exercises", workoutId],
    queryFn: () => getExercisesInWorkout(workoutId as string),
    enabled: !!workoutId && isAuthenticated, // Only fetch when authenticated
  });

  // Use guest data if not authenticated, server data if authenticated
  const exercises: Exercise[] = isAuthenticated
    ? Array.isArray(serverExercises)
      ? serverExercises
      : []
    : ((guestWorkout?.exercises ?? []) as unknown as Exercise[]);

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
      setShowFinishModal(false);
      navigate("/workouts");
    },
    onError: (error) => {
      console.error("Failed to finish workout:", error);
      setShowFinishModal(false);
    },
  });

  const generateRecapMutation = useMutation({
    mutationFn: (id: string) => api.post(endpoints.workoutRecap(id)),
    onSuccess: (response, id) => {
      // Update workout query data with the new recap
      queryClient.setQueryData(["workout", id], response.data);
    },
  });

  const handleRegenerateRecap = useCallback(() => {
    if (workoutId && isAuthenticated) {
      generateRecapMutation.mutate(workoutId);
    }
  }, [workoutId, isAuthenticated, generateRecapMutation]);

  // Trigger AI recap generation when the finish modal opens,
  // but only if we have exercises and are authenticated.
  useEffect(() => {
    if (
      showFinishModal &&
      workoutId &&
      isAuthenticated &&
      exercises.length > 0 &&
      !serverWorkout?.recap &&
      !generateRecapMutation.isPending &&
      !generateRecapMutation.isSuccess
    ) {
      generateRecapMutation.mutate(workoutId);
    }
  }, [
    showFinishModal,
    workoutId,
    isAuthenticated,
    exercises.length,
    serverWorkout?.recap,
    generateRecapMutation.isPending,
    generateRecapMutation.isSuccess,
  ]);

  // Keep the timer aligned to the active workout lifecycle.
  useEffect(() => {
    if (isAuthenticated) {
      if (!serverWorkout) return;
      syncWorkoutTimer({
        id: serverWorkout.id,
        startTime: serverWorkout.start_time,
        endTime: serverWorkout.end_time,
      });
      return;
    }

    if (!guestHydrated || !guestWorkout) return;

    syncWorkoutTimer({
      id: guestWorkout.id,
      startTime: guestWorkout.start_time,
      endTime: guestWorkout.end_time,
    });
  }, [
    serverWorkout,
    isAuthenticated,
    guestWorkout,
    guestHydrated,
    syncWorkoutTimer,
  ]);

  // Guest-only hydration from navigation state.
  // Authenticated routine starts are created server-side before navigation.
  useEffect(() => {
    if (routine && workoutId && exercises?.length === 0) {
      if (isAuthenticated) {
        // No-op: authenticated users should already receive a populated workout.
      } else {
        // Guest users create workout exercises locally from the routine template.
        guestCreateExercisesFromRoutine(routine, workoutId);
      }
    }
  }, [
    routine,
    workoutId,
    exercises.length,
    isAuthenticated,
    guestCreateExercisesFromRoutine,
  ]);

  useEffect(() => {
    if (!shouldScrollToBottomOnLoad || didHandleRouteScrollRef.current) return;
    didHandleRouteScrollRef.current = true;
    scrollExerciseListToBottom();
  }, [shouldScrollToBottomOnLoad]);

  useEffect(() => {
    const prevCount = previousExerciseCountRef.current;
    if (prevCount !== null && exercises.length > prevCount) {
      scrollExerciseListToBottom();
    }
    previousExerciseCountRef.current = exercises.length;
  }, [exercises.length]);

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

  // Optimistic create; replace optimistic entry with server response
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
      if (!ctx) return;

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
      if (!ctx) return;
      const mergedExercise: Exercise = {
        ...createdExercise,
        exercise_type:
          createdExercise.exercise_type ?? ctx.exerciseType,
        exercise_sets: createdExercise.exercise_sets ?? [],
      };
      queryClient.setQueryData(
        ["exercises", workoutId],
        (old: Exercise[] | undefined) => {
          if (!old) return [mergedExercise];
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

  const handleSelectExerciseType = useCallback((
    exerciseType: ExerciseType | GuestExerciseType,
  ) => {
    setShowAddExerciseModal(false);
    if (!workoutId) return;

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
    } else {
      // Guest mode: update local store directly (final update, not optimistic)
      const guestType = exerciseType as GuestExerciseType; // modal returns guest type in guest mode
      guestAddExercise({
        exercise_type_id: String(guestType.id),
        workout_id: String(workoutId),
        timestamp,
        notes: null,
        exercise_type: guestType,
      });
    }
  }, [addExerciseMutation, guestAddExercise, isAuthenticated, workoutId]);

  // Handle exercise updates (sets added/modified)
  const handleExerciseUpdate = useCallback((
    updatedExercise: Exercise,
    shouldInvalidateQuery: boolean = false,
  ) => {
    if (isAuthenticated && shouldInvalidateQuery) {
      // Only invalidate query when necessary (e.g., for structural changes, not notes)
      queryClient.invalidateQueries({ queryKey: ["exercises", workoutId] });
    } else if (isAuthenticated) {
      // For optimistic updates (like notes), just update the query data directly
      queryClient.setQueryData(
        ["exercises", workoutId],
        (oldData: Exercise[] | undefined) => {
          if (!oldData) return oldData;
          return oldData.map((exercise) =>
            exercise.id === updatedExercise.id ? updatedExercise : exercise,
          );
        },
      );
    } else {
      // For guest mode, update the local exercise data
      // Convert ExerciseSet[] to GuestExerciseSet[] by ensuring all IDs are strings
      const guestExerciseSets = updatedExercise.exercise_sets.map((set) => ({
        ...set,
        id: String(set.id),
        exercise_id: String(set.exercise_id),
      }));

      guestUpdateExercise(String(updatedExercise.id), {
        exercise_sets: guestExerciseSets,
      });
    }
  }, [guestUpdateExercise, isAuthenticated, queryClient, workoutId]);

  const handleFinishWorkout = useCallback(() => {
    if (workoutId) {
      if (isAuthenticated) {
        finishWorkoutMutation.mutate(workoutId);
      } else {
        // For guest mode, update the workout end time
        guestUpdateWorkout(workoutId, {
          end_time: getCurrentUTCTimestamp(),
        });
        setShowFinishModal(false);
        navigate("/workouts");
      }
    } else {
      console.error("No workoutId available");
    }
  }, [
    finishWorkoutMutation,
    guestUpdateWorkout,
    isAuthenticated,
    navigate,
    workoutId,
  ]);

  const handleCancelFinish = () => {
    setShowFinishModal(false);
    // Push the current state back to prevent navigation
    window.history.pushState(null, "", window.location.pathname);
  };

  const handleSaveRoutine = () => {
    setShowSaveRoutineModal(true);
  };

  // Determine workout name based on authentication state
  const workoutName = isAuthenticated
    ? (serverWorkout?.name ?? null)
    : (guestWorkout?.name ?? null);
  const workoutTypeId = isAuthenticated
    ? (serverWorkout?.workout_type_id ?? null)
    : (guestWorkout?.workout_type_id ?? null);
  const hasValidWorkout = isAuthenticated
    ? Boolean(serverWorkout)
    : guestHydrated && Boolean(guestWorkout);

  // Warn user on navigation/back while workout in progress
  useEffect(() => {
    if (!hasValidWorkout) {
      return;
    }

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };

    const handlePopState = () => {
      setShowFinishModal(true);
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("popstate", handlePopState);
    };
  }, [hasValidWorkout]);

  // Keep the route shell mounted and let the exercise section own its loading UI.
  const workoutErrorStatus = getErrorStatus(workoutError);
  const pagePending = !authInitialized || (isAuthenticated && workoutPending);
  const showNotFound = !workoutId
    || (authInitialized && !isAuthenticated && guestHydrated && !guestWorkout)
    || (isAuthenticated
      && (workoutErrorStatus === 403 || workoutErrorStatus === 404));
  const showRecoverableWorkoutError =
    isAuthenticated && Boolean(workoutError) && !showNotFound;
  const listPending = pagePending || (isAuthenticated && exercisesLoading);
  const listStatus: "pending" | "success" | "error" = listPending
    ? "pending"
    : isAuthenticated && exercisesError
      ? "error"
      : "success";
  const showLoadingTitle = pagePending && !workoutName;

  if (showNotFound) {
    return <NotFoundPage />;
  }

  if (showRecoverableWorkoutError) {
    const recoveryMessage = isNetworkError(workoutError)
      ? "Check your connection and try again."
      : "This may be temporary. Try again or go back to your workouts.";

    return (
      <div className="mx-auto max-w-5xl p-4 text-center">
        <div className="bg-card text-card-foreground mx-auto mt-4 max-w-2xl rounded-lg p-6 shadow-lg">
          <h2 className="text-2xl font-bold">We couldn&apos;t load this workout.</h2>
          <p className="text-muted-foreground mt-3">{recoveryMessage}</p>
          <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
            <Button
              type="button"
              onClick={() => {
                void refetchWorkout();
              }}
              disabled={workoutFetching}
            >
              {workoutFetching ? "Retrying..." : "Retry"}
            </Button>
            <Button asChild variant="outline">
              <Link to="/workouts">Back to Workouts</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl p-2 text-center md:p-4 lg:p-8">
      <div className="bg-card text-card-foreground mx-auto mt-2 max-w-2xl rounded-lg p-2 shadow-lg md:mt-4 md:p-4 lg:mt-8 lg:p-6">
        <div className="mb-3 flex items-center gap-4 text-left sm:mb-4 md:mb-6">
          <Button
            variant="ghost"
            size="icon"
            asChild
            aria-label="Go back"
          >
            <Link to="/workouts">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <h2 className="text-2xl font-bold">
            {showLoadingTitle ? (
              <>
                <span className="sr-only">Loading workout</span>
                <Skeleton
                  aria-hidden="true"
                  className="h-8 w-40 rounded md:w-52"
                />
              </>
            ) : workoutName ? (
              `${workoutName}`
            ) : (
              `Workout`
            )}
          </h2>
        </div>
        {!showLoadingTitle && serverWorkout?.end_time && serverWorkout?.recap && (
          <div className="bg-card/80 border-border mb-4 rounded-lg border p-4 text-left shadow-sm backdrop-blur-sm">
            <div className="mb-2 flex items-center gap-2">
              <span className="text-lg">✨</span>
              <h4 className="text-xs font-bold uppercase tracking-wider opacity-70">
                Workout Summary
              </h4>
            </div>
            <p className="text-foreground text-sm leading-relaxed italic">
              &ldquo;{serverWorkout.recap}&rdquo;
            </p>
          </div>
        )}
        <div
          ref={exerciseListContainerRef}
          className="space-y-4 max-h-[70vh] overflow-y-auto pr-2"
        >
          <ExerciseList
            exercises={exercises}
            status={listStatus}
            workoutId={workoutId}
            onExerciseUpdate={handleExerciseUpdate}
            onExerciseDelete={handleExerciseDelete}
          />
        </div>
        <div className="bg-primary mt-4 mb-4 h-px w-full" role="separator" />
        <div className="flex items-center justify-center">
          <Button
            type="button"
            onClick={() => setShowAddExerciseModal(true)}
            className="bg-primary/90 hover:bg-primary mt-2 px-6 py-2 backdrop-blur-sm"
            disabled={isAuthenticated && addExerciseMutation.isPending}
          >
            {isAuthenticated && addExerciseMutation.isPending
              ? "Adding..."
              : "Add Exercise"}
          </Button>
        </div>
      </div>

      <FloatingActionButton
        onClick={() => setShowFinishModal(true)}
        disabled={isAuthenticated && finishWorkoutMutation.isPending}
      >
        <span className="text-lg">✓</span>
      </FloatingActionButton>

      <FinishWorkoutModal
        isOpen={showFinishModal}
        onConfirm={handleFinishWorkout}
        onCancel={handleCancelFinish}
        isLoading={isAuthenticated && finishWorkoutMutation.isPending}
        exercises={exercises}
        onSaveRoutine={isAuthenticated ? handleSaveRoutine : undefined}
        workoutName={workoutName || undefined}
        recap={serverWorkout?.recap}
        isRecapLoading={generateRecapMutation.isPending}
        onRegenerateRecap={handleRegenerateRecap}
      />

      <SaveRoutineModal
        isOpen={showSaveRoutineModal}
        onClose={() => setShowSaveRoutineModal(false)}
        workoutName={workoutName || "My Routine"}
        exercises={exercises}
        workoutId={workoutId}
        workoutTypeId={workoutTypeId}
      />

      <ExerciseTypeModal
        isOpen={showAddExerciseModal}
        onClose={() => setShowAddExerciseModal(false)}
        onSelect={handleSelectExerciseType}
      />
    </div>
  );
};

export default WorkoutPage;
