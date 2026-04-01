import React from "react";
import axios from "axios";
import { Dumbbell } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useStartWorkoutFromRoutine } from "@/features/routines/hooks";
import type { Routine } from "@/features/routines/types";
import { useGuestStore, useAuthStore } from "@/stores";
import { useNavigate } from "react-router-dom";
import { getMyWorkouts, type Workout } from "@/features/workouts";
import { WorkoutForm } from "@/features/workouts/components";
import WorkoutCard from "@/features/workouts/components/WorkoutCard";
import FloatingActionButton from "@/shared/components/FloatingActionButton";
import { WeekTracking } from "@/shared/components/WeekTracking";
import { RoutinesSection } from "@/features/routines/components";
import { Button, Card } from "@/shared/components/ui";
import { getCurrentUTCTimestamp } from "@/utils/date";
import { WorkoutListSkeleton } from "@/shared/components/skeletons/WorkoutListSkeleton";

const MyWorkoutsPage = () => {
  const navigate = useNavigate();

  // Get state from stores
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const authLoading = useAuthStore((state) => state.loading);
  const setUser = useAuthStore((state) => state.setUser);
  const guestData = useGuestStore();
  const handleStartWorkoutFromRoutine = useStartWorkoutFromRoutine();

  const [showWorkoutForm, setShowWorkoutForm] = React.useState(false);

  const {
    data: serverWorkoutsResponse,
    isPending,
    error,
    refetch,
  } = useQuery({
    queryKey: ["workouts"],
    queryFn: () => getMyWorkouts(undefined, 100),
    enabled: isAuthenticated,
  });

  // Use guest data if not authenticated, server data if authenticated
  const workouts: Workout[] = React.useMemo(() => {
      if (isAuthenticated) {
      return Array.isArray(serverWorkoutsResponse?.data)
        ? serverWorkoutsResponse.data
        : [];
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
        workout_type_id: Number(gw.workout_type_id),
        created_at: gw.created_at || getCurrentUTCTimestamp(),
        updated_at: gw.updated_at || getCurrentUTCTimestamp(),
      }));
    }
  }, [isAuthenticated, serverWorkoutsResponse, guestData?.workouts]);

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
    React.useState<Routine | null>(null);

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
        <Card className="bg-card/80 border-border overflow-hidden rounded-2xl border shadow-xl backdrop-blur-sm p-8 text-center">
          <div className="bg-destructive/10 mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full">
            <span className="text-destructive text-2xl">⚠</span>
          </div>
          <h2 className="mb-2 text-xl font-semibold">Session Expired</h2>
          <p className="text-muted-foreground mb-4">{errorMessage}</p>
          <p className="text-muted-foreground text-sm">
            Click the logo above to return to login
          </p>
        </Card>
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
          <div className="mb-10 text-center">
            <h1 className="text-foreground text-4xl font-extrabold tracking-tight lg:text-5xl">
              Workouts
            </h1>
            <p className="text-muted-foreground mt-2 text-lg">
              Track your progress and crush your goals.
            </p>
          </div>
          <WeekTracking
            workouts={workouts}
            loading={listStatus === "pending"}
            className="mb-10"
          />

          <RoutinesSection onStartWorkout={handleStartWorkoutFromRoutine} />

          {showWorkoutForm && (
            <div className="bg-card/50 border-border mb-8 overflow-hidden rounded-2xl border p-6 shadow-xl backdrop-blur-sm">
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
                className="mt-4 w-full"
              >
                Cancel
              </Button>
            </div>
          )}

          {listStatus === "pending" ? (
            <WorkoutListSkeleton />
          ) : showEmpty ? (
            <div className="bg-card/30 border-border py-16 text-center border-2 border-dashed rounded-3xl backdrop-blur-sm">
              <div className="bg-primary/10 mx-auto flex h-20 w-20 items-center justify-center rounded-full mb-6">
                <Dumbbell className="text-primary h-10 w-10 opacity-40" />
              </div>
              <h3 className="text-xl font-bold mb-2">No workouts yet</h3>
              <p className="text-muted-foreground max-w-sm mx-auto px-6">
                You haven't logged any workouts. Ready to start your fitness journey?
              </p>
              <Button
                onClick={() => setShowWorkoutForm(true)}
                className="mt-8 px-8 py-6 rounded-xl text-lg shadow-lg hover:shadow-xl transition-all"
              >
                Start Your First Workout
              </Button>
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
