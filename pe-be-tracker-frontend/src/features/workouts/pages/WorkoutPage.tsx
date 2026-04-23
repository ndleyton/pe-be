import { Suspense, useEffect, useRef, useState, lazy } from "react";
import { useLocation, useParams, Link } from "react-router-dom";

import { ExerciseList } from "@/features/exercises/components";
import { Button } from "@/shared/components/ui/button";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { ArrowLeft, Sparkles } from "lucide-react";
import FloatingActionButton from "@/shared/components/FloatingActionButton";
import NotFoundPage from "@/pages/NotFoundPage";
import { createIntentPreload } from "@/shared/lib/createIntentPreload";
import { useAppBackNavigation } from "@/shared/hooks";
import {
  WorkoutPageLocationState,
  useWorkoutPageData,
} from "@/features/workouts/hooks/useWorkoutPageData";
import { useWorkoutExerciseActions } from "@/features/workouts/hooks/useWorkoutExerciseActions";

const FinishWorkoutModal = lazy(() =>
  import("@/features/workouts/components/FinishWorkoutModal/FinishWorkoutModal"),
);
const preloadFinishWorkoutModal = createIntentPreload(() =>
  import("@/features/workouts/components/FinishWorkoutModal/FinishWorkoutModal"),
);

const SaveRoutineModal = lazy(() =>
  import("@/features/routines/components/SaveRoutineModal/SaveRoutineModal").then(
    (m) => ({ default: m.SaveRoutineModal }),
  ),
);
const preloadSaveRoutineModal = createIntentPreload(() =>
  import("@/features/routines/components/SaveRoutineModal/SaveRoutineModal"),
);

const ExerciseTypeModal = lazy(() =>
  import("@/features/exercises/components/ExerciseTypeModal/ExerciseTypeModal"),
);

const WorkoutPage = () => {
  const { workoutId } = useParams();
  const goBack = useAppBackNavigation("/workouts");
  const location = useLocation();
  const routeState = location.state as WorkoutPageLocationState | null;

  const {
    exercises,
    hasValidWorkout,
    isAuthenticated,
    listStatus,
    recoveryMessage,
    refetchWorkout,
    serverWorkout,
    shouldScrollToBottomOnLoad,
    showLoadingTitle,
    showNotFound,
    showRecoverableWorkoutError,
    workoutEndTime,
    workoutFetching,
    workoutName,
    workoutTypeId,
  } = useWorkoutPageData({
    pathname: location.pathname,
    routeState,
    workoutId,
  });

  const [showFinishModal, setShowFinishModal] = useState(false);
  const [showSaveRoutineModal, setShowSaveRoutineModal] = useState(false);
  const [showAddExerciseModal, setShowAddExerciseModal] = useState(false);
  const bottomScrollAnchorRef = useRef<HTMLDivElement | null>(null);
  const didHandleRouteScrollRef = useRef(false);
  const previousExerciseCountRef = useRef<number | null>(null);

  const {
    addExerciseMutation,
    finishWorkoutMutation,
    generateRecapMutation,
    handleExerciseDelete,
    handleExerciseUpdate,
    handleFinishWorkout,
    handleRegenerateRecap,
    handleSelectExerciseType,
    warmExerciseTypeModal,
  } = useWorkoutExerciseActions({
    exercises,
    isAuthenticated,
    onFinishModalClose: () => setShowFinishModal(false),
    serverWorkout,
    showFinishModal,
    workoutId,
  });

  const scrollWorkoutPageToBottom = (behavior: ScrollBehavior = "smooth") => {
    requestAnimationFrame(() => {
      bottomScrollAnchorRef.current?.scrollIntoView({
        behavior,
        block: "end",
        inline: "nearest",
      });
    });
  };

  const scrollWorkoutPageToTop = () => {
    requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior: "auto" });
    });
  };

  const handleCancelFinish = () => {
    setShowFinishModal(false);
  };

  const handleSaveRoutine = () => {
    setShowSaveRoutineModal(true);
  };

  useEffect(() => {
    if (!hasValidWorkout) {
      return;
    }

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    const preloadTimeout = window.setTimeout(() => {
      preloadFinishWorkoutModal();
      preloadSaveRoutineModal();
    }, 2000);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.clearTimeout(preloadTimeout);
    };
  }, [hasValidWorkout]);

  useEffect(() => {
    if (listStatus !== "success" || didHandleRouteScrollRef.current) {
      return;
    }

    const isInProgress = !workoutEndTime;

    if (shouldScrollToBottomOnLoad || isInProgress) {
      didHandleRouteScrollRef.current = true;
      scrollWorkoutPageToTop();

      const followUpScrollTimers = [
        window.setTimeout(() => scrollWorkoutPageToBottom("smooth"), 50),
        window.setTimeout(() => scrollWorkoutPageToBottom("auto"), 400),
      ];

      return () => {
        followUpScrollTimers.forEach((timerId) => window.clearTimeout(timerId));
      };
    }
  }, [listStatus, shouldScrollToBottomOnLoad, workoutEndTime]);

  useEffect(() => {
    const prevCount = previousExerciseCountRef.current;
    if (prevCount !== null && exercises.length > prevCount) {
      scrollWorkoutPageToBottom();
    }
    previousExerciseCountRef.current = exercises.length;
  }, [exercises.length]);

  if (showNotFound) {
    return <NotFoundPage />;
  }

  if (showRecoverableWorkoutError) {
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
    <div className="mx-auto max-w-4xl px-4 py-6 md:py-8 text-center min-h-screen">
      <div className="mb-8 flex items-center gap-4 text-left">
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full bg-primary/5 hover:bg-primary hover:text-primary-foreground transition-all duration-300"
          aria-label="Go back"
          type="button"
          onClick={goBack}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h2 className="text-3xl font-black tracking-tight text-glow bg-gradient-to-b from-foreground to-foreground/70 bg-clip-text text-transparent">
          {showLoadingTitle ? (
            <>
              <span className="sr-only">Loading workout</span>
              <Skeleton
                aria-hidden="true"
                className="h-10 w-48 rounded-xl md:w-60"
              />
            </>
          ) : workoutName ? (
            `${workoutName}`
          ) : (
            "Workout"
          )}
        </h2>
      </div>

      <div className="space-y-6">
        {!showLoadingTitle && serverWorkout?.end_time && serverWorkout?.recap && (
          <div className="relative group overflow-hidden rounded-2xl border border-primary/20 bg-card/50 p-5 shadow-xl backdrop-blur-md transition-all duration-500 hover:border-primary/40 text-left mb-6">
            <div className="absolute -inset-1 bg-gradient-to-r from-primary/20 via-primary/5 to-primary/20 opacity-30 blur-2xl group-hover:opacity-50 transition-opacity duration-1000 animate-pulse" />

            <div className="relative">
              <div className="mb-3 flex items-center gap-2">
                <div className="bg-primary/10 flex h-8 w-8 items-center justify-center rounded-lg">
                  <Sparkles className="h-4 w-4 text-primary animate-pulse" />
                </div>
                <h4 className="text-[10px] font-black uppercase tracking-widest text-primary/80">
                  Personal Bestie:
                </h4>
              </div>
              <p className="text-foreground/90 text-[13px] leading-relaxed italic font-medium">
                &ldquo;{serverWorkout.recap}&rdquo;
              </p>
            </div>
          </div>
        )}
        <ExerciseList
          exercises={exercises}
          status={listStatus}
          workoutId={workoutId}
          onExerciseUpdate={handleExerciseUpdate}
          onExerciseDelete={handleExerciseDelete}
        />
        <div className="bg-primary/20 mt-8 mb-4 h-px w-full" role="separator" />
        <div className="flex items-center justify-center pb-24">
          <Button
            type="button"
            onClick={() => setShowAddExerciseModal(true)}
            onMouseEnter={warmExerciseTypeModal}
            onTouchStart={warmExerciseTypeModal}
            onFocus={warmExerciseTypeModal}
            className="h-14 rounded-full border border-primary/40 bg-primary/10 px-8 py-2 font-bold text-primary shadow-sm backdrop-blur-md transition-all duration-300 hover:bg-primary hover:text-primary-foreground"
            disabled={isAuthenticated && addExerciseMutation.isPending}
          >
            {isAuthenticated && addExerciseMutation.isPending
              ? "Adding..."
              : "Add Exercise"}
          </Button>
        </div>
        <div ref={bottomScrollAnchorRef} aria-hidden="true" />
      </div>

      <FloatingActionButton
        onClick={() => setShowFinishModal(true)}
        onMouseEnter={preloadFinishWorkoutModal}
        onTouchStart={preloadFinishWorkoutModal}
        onFocus={preloadFinishWorkoutModal}
        disabled={isAuthenticated && finishWorkoutMutation.isPending}
      >
        <span className="text-lg">✓</span>
      </FloatingActionButton>

      <FinishWorkoutModal
        isOpen={showFinishModal}
        onConfirm={handleFinishWorkout}
        onCancel={handleCancelFinish}
        isLoading={isAuthenticated && finishWorkoutMutation.isPending}
        isAuthenticated={isAuthenticated}
        exercises={exercises}
        onSaveRoutine={isAuthenticated ? handleSaveRoutine : undefined}
        workoutName={workoutName || undefined}
        recap={serverWorkout?.recap}
        isRecapLoading={generateRecapMutation.isPending}
        onRegenerateRecap={handleRegenerateRecap}
      />

      {showSaveRoutineModal ? (
        <Suspense fallback={null}>
          <SaveRoutineModal
            isOpen={showSaveRoutineModal}
            onClose={() => setShowSaveRoutineModal(false)}
            workoutName={workoutName || "My Routine"}
            exercises={exercises}
            workoutId={workoutId}
            workoutTypeId={workoutTypeId}
          />
        </Suspense>
      ) : null}

      {showAddExerciseModal ? (
        <Suspense fallback={null}>
          <ExerciseTypeModal
            isOpen={showAddExerciseModal}
            onClose={() => setShowAddExerciseModal(false)}
            onSelect={(exerciseType) => {
              setShowAddExerciseModal(false);
              handleSelectExerciseType(exerciseType);
            }}
          />
        </Suspense>
      ) : null}
    </div>
  );
};

export default WorkoutPage;
