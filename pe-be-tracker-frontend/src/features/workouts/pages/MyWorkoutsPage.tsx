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
import { createIntentPreload } from "@/shared/lib/createIntentPreload";

const MyWorkoutsPage = () => {
  const navigate = useNavigate();

  // Get state from stores
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const authLoading = useAuthStore((state) => state.loading);
  const authInitialized = useAuthStore((state) => state.initialized);
  const setUser = useAuthStore((state) => state.setUser);
  const guestData = useGuestStore();
  const guestHydrated = useGuestStore((state) => state.hydrated);
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
    enabled: authInitialized && !authLoading && isAuthenticated,
  });

  const authResolved = authInitialized && !authLoading;

  // Use guest data if not authenticated, server data if authenticated
  const workouts: Workout[] = React.useMemo(() => {
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

  const listPending =
    !authResolved || (isAuthenticated ? isPending : !guestHydrated);
  const listStatus: "pending" | "success" = listPending ? "pending" : "success";

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

  const preloadWorkoutPage = React.useMemo(
    () => createIntentPreload(() => import("@/features/workouts/pages")),
    [],
  );

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
  const showNoWorkoutsMessage =
    listStatus === "success" &&
    validWorkouts.length === 0;
  const shouldAutoOpenQuickStart =
    showNoWorkoutsMessage;

  // Early return for auth errors (after all hooks are called)
  if (isAuthenticated && (sessionExpired || isAuthError)) {
    const errorMessage = getErrorMessage(error);
    return (
      <div className="flex flex-1 items-center justify-center">
        <Card className="bg-card/80 border-border overflow-hidden rounded-2xl border p-8 text-center shadow-xl backdrop-blur-sm">
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
      <div className="mx-auto max-w-5xl px-4 py-6 text-center sm:p-8">
        <div className="mx-auto max-w-4xl">
          <div className="mb-8 text-center sm:mb-10">
            <h1 className="text-foreground text-4xl font-extrabold tracking-tight lg:text-5xl">
              Workouts
            </h1>
          </div>
          <WeekTracking
            workouts={workouts}
            loading={listStatus === "pending"}
            className="mb-10"
          />

          <RoutinesSection
            onStartWorkout={handleStartWorkoutFromRoutine}
            autoOpen={shouldAutoOpenQuickStart}
          />

          {showWorkoutForm && (
            <div className="bg-card/50 border-border mb-8 overflow-hidden rounded-2xl border p-4 shadow-xl backdrop-blur-sm sm:p-6">
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
          ) : (
            <>
              <div className="space-y-3 pt-4 sm:space-y-4">
                {showNoWorkoutsMessage ? (
                  <div className="bg-muted/30 border-border/60 rounded-xl border px-4 py-5 text-left">
                    <div className="flex items-start gap-3">
                      <div className="bg-primary/10 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg">
                        <Dumbbell className="text-primary h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-foreground text-sm font-medium">
                          You haven&apos;t logged any workouts yet.
                        </p>
                        <p className="text-muted-foreground mt-1 text-sm">
                          Pick a routine above or tap + to begin.
                        </p>
                      </div>
                    </div>
                  </div>
                ) : null}
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
