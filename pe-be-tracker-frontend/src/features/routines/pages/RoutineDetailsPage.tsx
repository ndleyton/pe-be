import { ArrowLeft } from "lucide-react";
import { Link, useParams } from "react-router-dom";

import {
  ExerciseTypeModal,
  IntensityUnitModal,
} from "@/features/exercises/components";
import {
  RoutineInfoCard,
  RoutineTemplatesCard,
} from "@/features/routines/components";
import {
  useRoutineDetailsActions,
  useRoutineDetailsData,
  useRoutineEditor,
} from "@/features/routines/hooks";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/shared/components/ui/alert";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent } from "@/shared/components/ui/card";
import { Skeleton } from "@/shared/components/ui/skeleton";

const RoutineDetailsLoadingState = () => (
  <>
    <Card>
      <CardContent className="grid gap-4 py-6">
        <div className="grid gap-2">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-10 w-full" />
        </div>
        <div className="grid gap-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-24 w-full" />
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Skeleton className="h-10 flex-1" />
          <Skeleton className="h-10 flex-1" />
          <Skeleton className="h-10 flex-1" />
        </div>
      </CardContent>
    </Card>

    <Card>
      <CardContent className="space-y-4 py-6">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-2">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-72" />
          </div>
          <Skeleton className="h-9 w-32" />
        </div>

        <div className="rounded-lg border bg-muted/30 p-4">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-4 w-28" />
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-9 w-36" />
              <Skeleton className="h-9 w-28" />
            </div>
          </div>

          <div className="space-y-3">
            {Array.from({ length: 2 }).map((_, index) => (
              <div
                key={index}
                className="rounded-md border bg-background p-3"
              >
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div className="space-y-2">
                    <Skeleton className="h-5 w-16" />
                    <Skeleton className="h-4 w-32" />
                  </div>
                  <Skeleton className="h-8 w-28" />
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                </div>
              </div>
            ))}
          </div>

          <Skeleton className="mt-3 h-9 w-28" />
        </div>
      </CardContent>
    </Card>
  </>
);

const RoutineDetailsPage = () => {
  const { routineId } = useParams();

  const {
    availableIntensityUnits,
    guestRoutine,
    isAuthenticated,
    routine,
    routineError,
    routinePending,
    unitsPending,
  } = useRoutineDetailsData(routineId);

  const {
    description,
    editorTemplates,
    exercisePickerTarget,
    hasInvalidTemplates,
    hasUnsavedChanges,
    name,
    unitPickerTarget,
    addSetToTemplate,
    closeExercisePicker,
    closeUnitPicker,
    handleExerciseTypeSelected,
    handleIntensityUnitSelected,
    openExercisePicker,
    openUnitPicker,
    removeSetFromTemplate,
    removeTemplate,
    setDescription,
    setName,
    updateSet,
  } = useRoutineEditor({
    availableIntensityUnits,
    routine,
  });

  const { deleteMutation, handleDelete, saveMutation, startMutation } =
    useRoutineDetailsActions({
      description,
      editorTemplates,
      guestRoutine,
      isAuthenticated,
      name,
      routine,
      routineId,
    });

  const isInitialLoading = isAuthenticated && (routinePending || unitsPending);

  if (!isInitialLoading && ((isAuthenticated && routineError) || !routine)) {
    return (
      <div className="container mx-auto px-4 py-6">
        <Alert variant="destructive">
          <AlertTitle>Routine unavailable</AlertTitle>
          <AlertDescription>
            We couldn&apos;t load this routine. It may have been deleted or you
            may not have access to it.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const actionError =
    saveMutation.error ?? startMutation.error ?? deleteMutation.error;

  return (
    <>
      <div className="mx-auto max-w-5xl p-2 text-center md:p-4 lg:p-8">
        <div className="bg-card text-card-foreground mx-auto mt-2 max-w-4xl rounded-lg p-2 shadow-lg md:mt-4 md:p-4 lg:mt-8 lg:p-6">
          <div className="mb-4 flex items-center gap-4 text-left">
            <Button
              variant="ghost"
              size="icon"
              asChild
              aria-label="Go back"
              className="lg:hidden"
            >
              <Link to="/routines">
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </Button>
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-2xl font-bold md:text-3xl">
                Routine Editor
              </h1>
              <p className="text-muted-foreground text-sm">
                {isInitialLoading
                  ? "Loading the routine structure and editor state..."
                  : "Edit the template directly. Changes save the full `exercise_templates` and `set_templates` tree in one request."}
              </p>
            </div>
          </div>

          <div className="grid gap-4 text-left">
            {!isInitialLoading && actionError && (
              <Alert variant="destructive">
                <AlertTitle>Action failed</AlertTitle>
                <AlertDescription>
                  {actionError instanceof Error
                    ? actionError.message
                    : "Something went wrong while updating the routine."}
                </AlertDescription>
              </Alert>
            )}

            {isInitialLoading ? (
              <RoutineDetailsLoadingState />
            ) : (
              <>
                <RoutineInfoCard
                  deleteDisabled={deleteMutation.isPending}
                  deleteLabel={deleteMutation.isPending ? "Deleting..." : "Delete Routine"}
                  description={description}
                  hasInvalidTemplates={hasInvalidTemplates}
                  name={name}
                  onDelete={handleDelete}
                  onDescriptionChange={setDescription}
                  onNameChange={setName}
                  onSave={() => saveMutation.mutate()}
                  onStartWorkout={() => startMutation.mutate()}
                  saveDisabled={
                    hasInvalidTemplates || !hasUnsavedChanges || saveMutation.isPending
                  }
                  saveLabel={saveMutation.isPending ? "Saving..." : "Save Routine"}
                  startDisabled={startMutation.isPending}
                  startLabel={startMutation.isPending ? "Starting..." : "Start Workout"}
                />

                <RoutineTemplatesCard
                  editorTemplates={editorTemplates}
                  onAddExercise={() => openExercisePicker({ mode: "add" })}
                  onAddSet={addSetToTemplate}
                  onChangeExercise={(templateId) =>
                    openExercisePicker({
                      mode: "replace",
                      templateId,
                    })
                  }
                  onRemoveSet={removeSetFromTemplate}
                  onRemoveTemplate={removeTemplate}
                  onSelectUnit={(templateId, setId) =>
                    openUnitPicker({ templateId, setId })
                  }
                  onUpdateSet={updateSet}
                />
              </>
            )}
          </div>
        </div>
      </div>

      <ExerciseTypeModal
        isOpen={exercisePickerTarget !== null}
        onClose={closeExercisePicker}
        onSelect={handleExerciseTypeSelected}
      />

      <IntensityUnitModal
        isOpen={unitPickerTarget !== null}
        onClose={closeUnitPicker}
        onSelect={handleIntensityUnitSelected}
      />
    </>
  );
};

export default RoutineDetailsPage;
