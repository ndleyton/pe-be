import React from "react";
import axios from "axios";
import { startWorkoutFromRoutine } from "@/features/routines/api";
import { useGuestStore, useAuthStore, GuestRoutine } from "@/stores";
import { useNavigate } from "react-router-dom";
import { getMyWorkouts, type Workout } from "@/features/workouts";
import { WorkoutForm } from "@/features/workouts/components";
import WorkoutCard from "@/features/workouts/components/WorkoutCard";
import FloatingActionButton from "@/shared/components/FloatingActionButton";
import { WeekTracking } from "@/shared/components/WeekTracking";
import { RoutinesSection } from "@/features/routines/components";
import { Button } from "@/shared/components/ui/button";
import { useInfiniteScroll } from "@/shared/hooks";
import { getCurrentUTCTimestamp } from "@/utils/date";
import { WorkoutListSkeleton } from "@/shared/components/skeletons/WorkoutListSkeleton";

const MyWorkoutsPage = () => {
  const navigate = useNavigate();

  // Get state from stores
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const authLoading = useAuthStore((state) => state.loading);
  const setUser = useAuthStore((state) => state.setUser);
  const guestData = useGuestStore();

  const [showWorkoutForm, setShowWorkoutForm] = React.useState(false);

  const {
    data: serverWorkouts,
    isPending,
    isFetchingNextPage,
    error,
    refetch,
  } = useInfiniteScroll<Workout>({
    queryKey: ["workouts"],
    queryFn: (cursor, limit) => getMyWorkouts(cursor, limit),
    limit: 100,
    enabled: isAuthenticated,
  });

  // Use guest data if not authenticated, server data if authenticated
  const workouts: Workout[] = React.useMemo(() => {
    if (isAuthenticated) {
      return Array.isArray(serverWorkouts) ? serverWorkouts : [];
    } else {
      const guestWorkouts = Array.isArray(guestData?.workouts)
        ? guestData.workouts
        : [];
      return guestWorkouts.map((gw) => ({
        id: gw.id,
        name: gw.name,
        notes: gw.notes,
        start_time: gw.start_time,
        end_time: gw.end_time,
        created_at: gw.created_at || getCurrentUTCTimestamp(),
        updated_at: gw.updated_at || getCurrentUTCTimestamp(),
      }));
    }
  }, [isAuthenticated, serverWorkouts, guestData?.workouts]);

  const listPending = isAuthenticated && (authLoading || isPending);
  const listStatus: "pending" | "success" = listPending ? "pending" : "success";
  // Gate empty-state for guests until guest store hydration completes
  const guestHydrated = useGuestStore((state) => state.hydrated);

  const getErrorMessage = (error: unknown) => {
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 401 || error.response?.status === 403) {
        return "Please log in to view your workouts.";
      }
      return "Failed to load workouts.";
    }
    return error instanceof Error ? error.message : "Failed to load workouts.";
  };

  const handleWorkoutClick = (workoutId: number | string) => {
    navigate(`/workouts/${workoutId}`);
  };

  const [selectedRoutine, setSelectedRoutine] =
    React.useState<GuestRoutine | null>(null);

  // preloading of the WorkoutPage lazy chunk to speed up navigation
  const preloadedRef = React.useRef(false);
  const preloadWorkoutPage = React.useCallback(() => {
    if (preloadedRef.current) return;
    preloadedRef.current = true;
    void import("@/features/workouts/pages").catch(() => {
      // If preloading fails, allow future attempts
      preloadedRef.current = false;
    });
  }, []);

  const handleStartWorkoutFromRoutine = async (routine: GuestRoutine) => {
    try {
      if (isAuthenticated) {
        // Create full workout from routine on the server
        const newWorkout = await startWorkoutFromRoutine(Number(routine.id));
        navigate(`/workouts/${newWorkout.id}`);
      } else {
        // Create guest workout with default values
        const defaultWorkoutType =
          guestData.workoutTypes.find((wt) => wt.id === "8") ||
          guestData.workoutTypes[0];
        const newWorkoutId = useGuestStore.getState().addWorkout({
          name: `${routine.name} - ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" })}`,
          notes: null,
          start_time: new Date().toISOString(),
          end_time: null,
          workout_type_id: defaultWorkoutType.id,
          workout_type: defaultWorkoutType,
          exercises: [],
        });
        navigate(`/workouts/${newWorkoutId}`, { state: { routine } });
      }
    } catch (error) {
      console.error("Failed to start workout from routine:", error);
    }
  };

  // Track if we've detected an auth error to keep showing the message
  const [sessionExpired, setSessionExpired] = React.useState(false);

  React.useEffect(() => {
    const authErr =
      axios.isAxiosError(error) &&
      (error.response?.status === 401 || error.response?.status === 403);
    if (isAuthenticated && authErr) {
      if (typeof setUser === "function") {
        setUser(null);
      }
      setSessionExpired(true);
    }
  }, [isAuthenticated, error, setUser]);

  const isAuthError =
    axios.isAxiosError(error) &&
    (error?.response?.status === 401 || error?.response?.status === 403);

  const validWorkouts = Array.isArray(workouts) ? workouts.filter(Boolean) : [];
  // Decide if empty-state should be shown in a readable way
  const showEmpty = React.useMemo(() => {
    // Only after list has finished initial loading
    if (listStatus !== "success") return false;
    // Only if there are truly no workouts to render
    if (validWorkouts.length > 0) return false;
    // Authenticated users are ready; guests must wait for guest store hydration
    return isAuthenticated || guestHydrated;
  }, [listStatus, validWorkouts.length, isAuthenticated, guestHydrated]);

  // Early return for auth errors (after all hooks are called)
  if (isAuthenticated && (sessionExpired || isAuthError)) {
    const errorMessage = getErrorMessage(error);
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="text-center">
          <div className="bg-destructive/10 mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full">
            <span className="text-destructive text-2xl">⚠</span>
          </div>
          <h2 className="mb-2 text-xl font-semibold">Session Expired</h2>
          <p className="text-muted-foreground mb-4">{errorMessage}</p>
          <p className="text-muted-foreground text-sm">
            Click the logo above to return to login
          </p>
        </div>
      </div>
    );
  }

  // Early return for other errors (after all hooks are called)
  if (isAuthenticated && error) {
    const errorMessage = getErrorMessage(error);
    return <p className="text-destructive">{errorMessage}</p>;
  }

  return (
    <>
      <div className="mx-auto max-w-5xl p-8 text-center">
        <div className="mx-auto max-w-4xl">
          <div className="mb-6">
            <h1 className="text-2xl font-semibold">Workouts</h1>
          </div>
          <WeekTracking
            workouts={workouts}
            loading={listStatus === "pending"}
            className="mb-6"
          />

          <RoutinesSection onStartWorkout={handleStartWorkoutFromRoutine} />

          {showWorkoutForm && (
            <div className="mb-6">
              <WorkoutForm
                routine={selectedRoutine}
                onWorkoutCreated={(workoutId) => {
                  if (isAuthenticated) {
                    refetch();
                  }
                  setShowWorkoutForm(false);
                  setSelectedRoutine(null);
                  if (selectedRoutine) {
                    navigate(`/workouts/${workoutId}`, {
                      state: { routine: selectedRoutine },
                    });
                  }
                }}
              />
              <Button
                onClick={() => {
                  setShowWorkoutForm(false);
                  setSelectedRoutine(null);
                }}
                variant="ghost"
                size="sm"
                className="mt-2"
              >
                Cancel
              </Button>
            </div>
          )}

          {listStatus === "pending" ? (
            <WorkoutListSkeleton />
          ) : showEmpty ? (
            <div className="py-12 text-center">
              <p className="text-muted-foreground">
                You haven't logged any workouts yet.
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-3">
                {validWorkouts.map((workout) => (
                  <WorkoutCard
                    key={workout.id}
                    workout={workout}
                    onClick={handleWorkoutClick}
                    onMouseEnter={preloadWorkoutPage}
                    onTouchStart={preloadWorkoutPage}
                  />
                ))}
              </div>

              {/* Loading more indicator for authenticated users */}
              {isAuthenticated && isFetchingNextPage && (
                <div className="flex justify-center py-8">
                  <span className="loading loading-spinner loading-lg"></span>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {!showWorkoutForm && (
        <FloatingActionButton
          onClick={() => setShowWorkoutForm(true)}
          dataTestId="fab-add-workout"
        >
          <span className="text-lg">+</span>
        </FloatingActionButton>
      )}
    </>
  );
};

export default MyWorkoutsPage;
