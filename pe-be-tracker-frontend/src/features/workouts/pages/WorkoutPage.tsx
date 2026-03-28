import { useCallback, useState } from "react";
import { useParams, useLocation, Link } from "react-router-dom";
import { ExerciseList, ExerciseTypeModal } from "@/features/exercises/components";
import { FinishWorkoutModal } from "@/features/workouts/components";
import {
  useWorkoutExerciseActions,
  useWorkoutPageData,
} from "@/features/workouts/hooks";
import { Button } from "@/shared/components/ui/button";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { ArrowLeft } from "lucide-react";
import { SaveRoutineModal } from "@/features/routines/components/SaveRoutineModal/SaveRoutineModal";
import FloatingActionButton from "@/shared/components/FloatingActionButton";
import { GuestRoutine } from "@/stores";
import NotFoundPage from "@/pages/NotFoundPage";

const WorkoutPage = () => {
  const { workoutId } = useParams();
  const location = useLocation();

  const [showFinishModal, setShowFinishModal] = useState(false);
  const [showSaveRoutineModal, setShowSaveRoutineModal] = useState(false);
  const [showAddExerciseModal, setShowAddExerciseModal] = useState(false);

  const routine = location.state?.routine as GuestRoutine | undefined;
  const shouldScrollToBottomOnLoad = Boolean(
    location.state?.scrollToBottomOnLoad,
  );

  const openFinishModal = useCallback(() => {
    setShowFinishModal(true);
  }, []);

  const {
    authLoading,
    exercises,
    exerciseListContainerRef,
    isAuthenticated,
    listStatus,
    recoveryMessage,
    refetchWorkout,
    showNotFound,
    showRecoverableWorkoutError,
    workoutFetching,
    workoutName,
    workoutPending,
    workoutTypeId,
  } = useWorkoutPageData({
    workoutId,
    routine,
    shouldScrollToBottomOnLoad,
    onPromptFinishWorkout: openFinishModal,
  });

  const {
    handleExerciseDelete,
    handleExerciseUpdate,
    handleFinishWorkout,
    handleSelectExerciseType,
    isAddingExercise,
    isFinishingWorkout,
  } = useWorkoutExerciseActions({
    workoutId,
    isAuthenticated,
    setShowAddExerciseModal,
    setShowFinishModal,
  });

  const handleCancelFinish = () => {
    setShowFinishModal(false);
    // Push the current state back to prevent navigation
    window.history.pushState(null, "", window.location.pathname);
  };

  const handleSaveRoutine = () => {
    setShowSaveRoutineModal(true);
  };
  const showWorkoutShellLoading = isAuthenticated && (authLoading || workoutPending);

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
          {showWorkoutShellLoading ? (
            <Skeleton className="h-8 w-48" />
          ) : (
            <h2 className="text-2xl font-bold">
              {workoutName ? `${workoutName}` : `Workout: #${workoutId}`}
            </h2>
          )}
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
            disabled={showWorkoutShellLoading || isAddingExercise}
          >
            {isAddingExercise ? "Adding..." : "Add Exercise"}
          </Button>
        </div>
      </div>

      <FloatingActionButton
        onClick={() => setShowFinishModal(true)}
        disabled={showWorkoutShellLoading || isFinishingWorkout}
      >
        <span className="text-lg">✓</span>
      </FloatingActionButton>

      <FinishWorkoutModal
        isOpen={showFinishModal}
        onConfirm={handleFinishWorkout}
        onCancel={handleCancelFinish}
        isLoading={isFinishingWorkout}
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
