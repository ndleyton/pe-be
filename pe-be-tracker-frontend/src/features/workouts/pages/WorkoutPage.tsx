import { useEffect, useState, useMemo, useRef } from "react";
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
import { Button } from "@/shared/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { SaveRoutineModal } from "@/features/routines/components/SaveRoutineModal/SaveRoutineModal";
import FloatingActionButton from "@/shared/components/FloatingActionButton";
import {
  useGuestStore,
  useAuthStore,
  useUIStore,
  GuestExercise,
  GuestRoutine,
  GuestExerciseType,
} from "@/stores";
import { getCurrentUTCTimestamp } from "@/utils/date";

const updateWorkoutEndTime = async (workoutId: string) => {
  const response = await api.patch(`/workouts/${workoutId}`, {
    end_time: getCurrentUTCTimestamp(),
  });
  return response.data;
};

// Fetch a single workout by ID (for authenticated users)
const fetchWorkout = async (workoutId: string): Promise<Workout> => {
  const response = await api.get(`/workouts/${workoutId}`);
  return response.data as Workout;
};

const WorkoutPage = () => {
  const { workoutId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();

  // Get state from stores
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const authLoading = useAuthStore((state) => state.loading);
  const guestData = useGuestStore();
  const guestActions = useGuestStore();
  const guestHydrated = useGuestStore((state) => state.hydrated);

  // Get workout timer state and actions from UI store
  const startTime = useUIStore((state) => state.workoutTimer.startTime);
  const startWorkoutTimer = useUIStore((state) => state.startWorkoutTimer);
  const stopWorkoutTimer = useUIStore((state) => state.stopWorkoutTimer);

  const [showFinishModal, setShowFinishModal] = useState(false);
  const [showSaveRoutineModal, setShowSaveRoutineModal] = useState(false);
  const [showAddExerciseModal, setShowAddExerciseModal] = useState(false);
  const [shouldScrollToBottom, setShouldScrollToBottom] = useState(false);
  const exerciseListContainerRef = useRef<HTMLDivElement | null>(null);

  const routine = location.state?.routine as GuestRoutine | undefined;

  // Fetch workout details (only when authenticated)
  const { data: serverWorkout } = useQuery({
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

  const handleExerciseDelete = (exerciseId: number | string) => {
    if (isAuthenticated) {
      deleteExerciseMutation.mutate(exerciseId);
    } else {
      // Guest deletion via store
      guestActions.deleteExercise(String(exerciseId));
    }
  };

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
  const exercises: Exercise[] = useMemo(() => {
    if (isAuthenticated) {
      return Array.isArray(serverExercises) ? serverExercises : [];
    } else {
      const guestWorkout = guestData.workouts.find((w) => w.id === workoutId);
      const guestExercises = guestWorkout?.exercises || [];
      return Array.isArray(guestExercises)
        ? guestExercises.map(
          (guestExercise: GuestExercise): Exercise => ({
            id: guestExercise.id,
            timestamp: guestExercise.timestamp,
            notes: guestExercise.notes,
            exercise_type_id: guestExercise.exercise_type_id,
            workout_id: guestExercise.workout_id,
            created_at: guestExercise.created_at,
            updated_at: guestExercise.updated_at,
            exercise_type: {
              id: parseInt(guestExercise.exercise_type.id) || 0,
              name: guestExercise.exercise_type.name,
              description: guestExercise.exercise_type.description,
              default_intensity_unit:
                guestExercise.exercise_type.default_intensity_unit,
              times_used: guestExercise.exercise_type.times_used,
              equipment: guestExercise.exercise_type.equipment || null,
              instructions: guestExercise.exercise_type.instructions || null,
              category: guestExercise.exercise_type.category || null,
              created_at:
                guestExercise.exercise_type.created_at ||
                guestExercise.created_at,
              updated_at:
                guestExercise.exercise_type.updated_at ||
                guestExercise.updated_at,
              usage_count:
                guestExercise.exercise_type.usage_count ||
                guestExercise.exercise_type.times_used,
              // Ensure muscles and muscle_groups are passed through
              muscles: guestExercise.exercise_type.muscles || [],
              muscle_groups: guestExercise.exercise_type.muscle_groups || [],
            },
            exercise_sets: Array.isArray(guestExercise.exercise_sets)
              ? guestExercise.exercise_sets.map((guestSet) => ({
                id: guestSet.id,
                reps: guestSet.reps,
                intensity: guestSet.intensity,
                intensity_unit_id: guestSet.intensity_unit_id,
                exercise_id: guestSet.exercise_id,
                rest_time_seconds: guestSet.rest_time_seconds,
                done: guestSet.done,
                created_at: guestSet.created_at,
                updated_at: guestSet.updated_at,
              }))
              : [],
          }),
        )
        : [];
    }
  }, [isAuthenticated, serverExercises, guestData.workouts, workoutId]);

  const finishWorkoutMutation = useMutation({
    mutationFn: (id: string) => updateWorkoutEndTime(id),
    onSuccess: () => {
      setShowFinishModal(false);
      navigate("/workouts");
    },
    onError: (error) => {
      console.error("Failed to finish workout:", error);
      setShowFinishModal(false);
    },
  });

  // Start or align the workout timer to the canonical start time
  useEffect(() => {
    // Determine canonical start time from server (auth) or persisted guest data
    let derived: Date | undefined;
    if (isAuthenticated) {
      const ws = serverWorkout?.start_time ?? undefined;
      if (ws) {
        const d = new Date(ws);
        if (!isNaN(d.getTime()) && d.getTime() <= Date.now()) {
          derived = d;
        }
      }
    } else {
      if (guestHydrated) {
        const guestWorkout = guestData.workouts.find((w) => w.id === workoutId);
        const ws = guestWorkout?.start_time ?? undefined;
        if (ws) {
          const d = new Date(ws);
          if (!isNaN(d.getTime()) && d.getTime() <= Date.now()) {
            derived = d;
          }
        }
      } else {
        // Wait for hydration before attempting to start in guest mode
        return;
      }
    }

    // If we have a derived start and timer hasn't started yet, start aligned to it.
    // IMPORTANT: Only do this when startTime is null (timer not yet started).
    // If startTime exists but differs from derivedMs, that's expected after pause/resume
    // adjustments - we should NOT reset it back to the original time.
    if (derived) {
      if (startTime == null) {
        startWorkoutTimer(derived.getTime());
      }
      return;
    }

    // Fallbacks
    // - Authenticated: wait for server value to avoid incorrect resets
    // - Guest: after hydration, if no stored start is found, start now
    if (!isAuthenticated) {
      // Only auto-start when there's truly no startTime yet (null)
      if (!derived && startTime == null && guestHydrated) {
        startWorkoutTimer();
      }
    }
  }, [
    serverWorkout,
    workoutId,
    isAuthenticated,
    guestData.workouts,
    guestHydrated,
    startTime,
    startWorkoutTimer,
  ]);

  // Auto-create exercises from routine when page loads
  useEffect(() => {
    if (routine && workoutId && exercises?.length === 0) {
      if (isAuthenticated) {
        // For authenticated users, we'd need to make API calls
        // This is simplified - would need to implement full API integration
      } else {
        // For guest users, create exercises from the routine
        guestActions.createExercisesFromRoutine(routine, workoutId);
      }
    }
  }, [routine, workoutId, exercises?.length, isAuthenticated, guestActions]);

  useEffect(() => {
    if (!shouldScrollToBottom) return;

    requestAnimationFrame(() => {
      const container = exerciseListContainerRef.current;
      if (!container) return;
      container.scrollTo({
        top: container.scrollHeight,
        behavior: "smooth",
      });
    });

    setShouldScrollToBottom(false);
  }, [shouldScrollToBottom, exercises.length]);

  type AddExercisePayload = {
    data: CreateExerciseData;
    exerciseType: ExerciseType;
  };

  // Optimistic create; replace optimistic entry with server response
  const addExerciseMutation = useMutation({
    mutationFn: ({ data }: AddExercisePayload) => createExercise(data),
    onMutate: async ({ data, exerciseType }: AddExercisePayload) => {
      await queryClient.cancelQueries({ queryKey: ["exercises", workoutId] });
      const prev = queryClient.getQueryData<Exercise[]>([
        "exercises",
        workoutId,
      ]);
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
        ["exercises", workoutId],
        (old: Exercise[] | undefined) =>
          old ? [...old, optimisticExercise] : [optimisticExercise],
      );
      setShouldScrollToBottom(true);

      return { prev, optimisticId, exerciseType };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) {
        queryClient.setQueryData(["exercises", workoutId], ctx.prev);
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

  const handleSelectExerciseType = (
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
      guestActions.addExercise({
        exercise_type_id: String(guestType.id),
        workout_id: String(workoutId),
        timestamp,
        notes: null,
        exercise_type: guestType,
      });
      setShouldScrollToBottom(true);
    }
  };

  // Handle exercise updates (sets added/modified)
  const handleExerciseUpdate = (
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

      guestActions.updateExercise(String(updatedExercise.id), {
        exercise_sets: guestExerciseSets,
      });
    }
  };

  const handleFinishWorkout = () => {
    if (workoutId) {
      if (isAuthenticated) {
        finishWorkoutMutation.mutate(workoutId, {
          onSuccess: () => {
            stopWorkoutTimer();
          },
        });
      } else {
        // For guest mode, update the workout end time
        guestActions.updateWorkout(workoutId, {
          end_time: getCurrentUTCTimestamp(),
        });
        stopWorkoutTimer();
        setShowFinishModal(false);
        navigate("/workouts");
      }
    } else {
      console.error("No workoutId available");
    }
  };

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
    : (guestData.workouts.find((w) => w.id === workoutId)?.name ?? null);

  // Warn user on navigation/back while workout in progress
  useEffect(() => {
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
  }, []);

  // Streamlined status computation
  // For guests, avoid showing the skeleton; only show when authenticated
  const listPending = isAuthenticated && (authLoading || exercisesLoading);
  const listStatus: "pending" | "success" | "error" = listPending
    ? "pending"
    : isAuthenticated && exercisesError
      ? "error"
      : "success";

  return (
    <div className="mx-auto max-w-5xl p-2 text-center md:p-4 lg:p-8">
      <div className="bg-card text-card-foreground mx-auto mt-2 max-w-2xl rounded-lg p-2 shadow-lg md:mt-4 md:p-4 lg:mt-8 lg:p-6">
        <div className="mb-3 flex items-center gap-4 text-left sm:mb-4 md:mb-6">
          <Button
            variant="ghost"
            size="icon"
            asChild
            aria-label="Go back"
            className="lg:hidden"
          >
            <Link to="/workouts">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <h2 className="text-2xl font-bold">
            {workoutName ? `${workoutName}` : `Workout: #${workoutId}`}
          </h2>
        </div>
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
            className="bg-primary hover:bg-primary/90 mt-2 px-6 py-2"
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
        onSaveRoutine={handleSaveRoutine}
        workoutName={workoutName || undefined}
      />

      <SaveRoutineModal
        isOpen={showSaveRoutineModal}
        onClose={() => setShowSaveRoutineModal(false)}
        workoutName={workoutName || "My Routine"}
        exercises={exercises}
        workoutId={workoutId}
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
