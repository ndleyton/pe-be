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

const RoutineDetailsPage = () => {
  const { routineId } = useParams();

  const {
    availableIntensityUnits,
    canEdit,
    editAccessMessage,
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
      canEdit,
      description,
      editorTemplates,
      guestRoutine,
      isAuthenticated,
      name,
      routine,
      routineId,
    });

  if (routinePending || (isAuthenticated && unitsPending)) {
    return (
      <div className="container mx-auto px-4 py-6">
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Loading routine...
          </CardContent>
        </Card>
      </div>
    );
  }

  if ((isAuthenticated && routineError) || !routine) {
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
                {canEdit ? "Routine Editor" : "Routine Details"}
              </h1>
              <p className="text-muted-foreground text-sm">
                {canEdit
                  ? "Edit the template directly. Changes save the full `exercise_templates` and `set_templates` tree in one request."
                  : "Review this routine template and start a workout from it."}
              </p>
            </div>
          </div>

          <div className="grid gap-4 text-left">
            {editAccessMessage && (
              <Alert>
                <AlertTitle>View-only routine</AlertTitle>
                <AlertDescription>{editAccessMessage}</AlertDescription>
              </Alert>
            )}

            {actionError && (
              <Alert variant="destructive">
                <AlertTitle>Action failed</AlertTitle>
                <AlertDescription>
                  {actionError instanceof Error
                    ? actionError.message
                    : "Something went wrong while updating the routine."}
                </AlertDescription>
              </Alert>
            )}

            <RoutineInfoCard
              canEdit={canEdit}
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
              canEdit={canEdit}
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
