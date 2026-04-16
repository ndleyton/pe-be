import { useMyWorkoutsData } from "@/features/workouts";
import { WorkoutForm } from "@/features/workouts/components";
import WorkoutCard from "@/features/workouts/components/WorkoutCard";
import FloatingActionButton from "@/shared/components/FloatingActionButton";
import { useUIStore, useAuthStore } from "@/stores";
import { useNavigate } from "react-router-dom";
import { WeekTracking } from "@/shared/components/WeekTracking";
import { RoutinesSection } from "@/features/routines/components";
import { Card, Dialog, DialogContent, DialogHeader, DialogTitle } from "@/shared/components/ui";
import { WorkoutListSkeleton } from "@/shared/components/skeletons/WorkoutListSkeleton";
import { createIntentPreload } from "@/shared/lib/createIntentPreload";
import { useStartWorkoutFromRoutine } from "@/features/routines/hooks";
import type { Routine } from "@/features/routines/types";
import axios from "axios";
import { useState, useMemo, useEffect } from "react";

const MyWorkoutsPage = () => {
  const navigate = useNavigate();

  const setUser = useAuthStore((state) => state.setUser);
  const handleStartWorkoutFromRoutine = useStartWorkoutFromRoutine();

  const { isWorkoutFormOpen, openWorkoutForm, closeWorkoutForm } = useUIStore();
  const { workouts, isLoading: listPending, error, refetch, isAuthenticated } = useMyWorkoutsData();

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
    useState<Routine | null>(null);

  const preloadWorkoutPage = useMemo(
    () => createIntentPreload(() => import("@/features/workouts/pages")),
    [],
  );

  // Track if we've detected an auth error to keep showing the message
  const [sessionExpired, setSessionExpired] = useState(false);

  useEffect(() => {
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
            <h1 className="text-4xl font-black tracking-tight text-foreground sm:text-5xl text-glow bg-gradient-to-b from-foreground to-foreground/70 bg-clip-text text-transparent">
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

          <Dialog open={isWorkoutFormOpen} onOpenChange={(open) => {
            if (!open) {
              closeWorkoutForm();
              setSelectedRoutine(null);
            }
          }}>
            <DialogContent className="sm:max-w-lg" data-testid="workout-form-dialog">
              <DialogHeader className="sr-only">
                <DialogTitle>
                  {selectedRoutine ? "Start from Routine" : "Start Workout"}
                </DialogTitle>
              </DialogHeader>
              <div className="mt-2">
                <WorkoutForm
                  routine={selectedRoutine}
                  onWorkoutCreated={(_workoutId) => {
                    if (isAuthenticated) {
                      refetch();
                    }
                    closeWorkoutForm();
                    setSelectedRoutine(null);
                  }}
                />
              </div>
            </DialogContent>
          </Dialog>

          {listStatus === "pending" ? (
            <WorkoutListSkeleton />
          ) : (
            <>
              <div className="space-y-3 pt-4 sm:space-y-4">
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

      {!isWorkoutFormOpen && (
        <FloatingActionButton
          onClick={() => openWorkoutForm()}
          dataTestId="fab-add-workout"
        >
          <span className="text-lg">+</span>
        </FloatingActionButton>
      )}
    </>
  );
};

export default MyWorkoutsPage;
