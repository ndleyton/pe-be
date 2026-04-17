import { ArrowLeft } from "lucide-react";
import { useCallback } from "react";
import { useBlocker } from "react-router-dom";

import {
  ExerciseTypeModal,
  IntensityUnitModal,
} from "@/features/exercises/components";
import {
  RoutineInfoCard,
  RoutineTemplatesCard,
} from "@/features/routines/components";
import {
  useRoutineCreateActions,
  useRoutineDetailsData,
  useRoutineEditor,
} from "@/features/routines/hooks";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/shared/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/components/ui/alert-dialog";
import { Button } from "@/shared/components/ui/button";
import { useAppBackNavigation } from "@/shared/hooks";

const CreateRoutinePage = () => {
  const handleBack = useAppBackNavigation("/routines");

  // We use useRoutineDetailsData with undefined routineId to get available intensity units
  const { availableIntensityUnits, isAuthenticated, unitsPending } =
    useRoutineDetailsData(undefined);

  const {
    description,
    editorTemplates,
    exercisePickerTarget,
    hasInvalidTemplates,
    hasUnsavedChanges,
    name,
    visibility,
    author,
    category,
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
    setVisibility,
    setAuthor,
    setCategory,
    setName,
    updateSet,
    updateTemplate,
  } = useRoutineEditor({
    availableIntensityUnits,
    routine: null,
  });

  const { saveMutation } = useRoutineCreateActions({
    description,
    editorTemplates,
    isAuthenticated,
    name,
    visibility,
    author,
    category,
  });

  // Guard for unsaved changes
  const blocker = useBlocker(
    useCallback(() => hasUnsavedChanges, [hasUnsavedChanges]),
  );

  const handleSave = async () => {
    await saveMutation.mutateAsync();
  };

  const handleCancel = () => {
    if (hasUnsavedChanges) {
      if (
        confirm("You have unsaved changes. Are you sure you want to cancel?")
      ) {
        handleBack();
      }
    } else {
      handleBack();
    }
  };

  return (
    <>
      <div className="mx-auto min-h-screen max-w-4xl px-4 py-6 md:py-8">
        {/* Header Section */}
        <div className="mb-8 flex items-center gap-4 text-left">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Go back"
            type="button"
            onClick={handleBack}
            className="rounded-full bg-primary/5 hover:bg-primary hover:text-primary-foreground transition-all duration-300"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="min-w-0 flex-1">
            <h1 className="min-w-0 truncate bg-gradient-to-b from-foreground to-foreground/70 bg-clip-text text-3xl font-black tracking-tight text-transparent text-glow">
              New Routine
            </h1>
            <p className="mt-1 text-xs font-bold uppercase tracking-widest text-muted-foreground/70">
              Create a custom plan
            </p>
          </div>
        </div>

        <div className="grid gap-8 text-left">
          {!isAuthenticated && (
            <Alert variant="destructive">
              <AlertTitle>Authentication required</AlertTitle>
              <AlertDescription>
                You must be signed in to create and save routines.
              </AlertDescription>
            </Alert>
          )}

          {saveMutation.error && (
            <Alert
              variant="destructive"
              className="rounded-2xl border-destructive/20 bg-destructive/5 backdrop-blur-md"
            >
              <AlertTitle className="text-xs font-bold uppercase tracking-wider">
                Creation failed
              </AlertTitle>
              <AlertDescription className="text-sm">
                {saveMutation.error instanceof Error
                  ? saveMutation.error.message
                  : "Something went wrong while creating the routine."}
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-8">
            <RoutineInfoCard
              canEdit={true}
              editDisabled={unitsPending}
              isEditing={true}
              deleteDisabled={true}
              deleteLabel="Delete Routine"
              description={description}
              hasInvalidTemplates={hasInvalidTemplates}
              name={name}
              visibility={visibility}
              author={author}
              category={category}
              onDelete={() => {}} // No delete in create mode
              onDescriptionChange={setDescription}
              onNameChange={setName}
              onVisibilityChange={setVisibility}
              onAuthorChange={setAuthor}
              onCategoryChange={setCategory}
              onSave={handleSave}
              onStartWorkout={() => {}} // No start in create mode
              onEdit={() => {}}
              onCancel={handleCancel}
              saveDisabled={
                hasInvalidTemplates || !isAuthenticated || saveMutation.isPending
              }
              saveLabel={
                saveMutation.isPending ? "Creating..." : "Create Routine"
              }
              startDisabled={true}
              startLabel="Start Workout"
            />

            <div className="relative">
              <div
                className="absolute inset-0 flex items-center"
                aria-hidden="true"
              >
                <div className="w-full border-t border-border/40"></div>
              </div>
              <div className="relative flex justify-center text-xs font-bold uppercase tracking-widest">
                <span className="bg-background px-4 text-muted-foreground/40">
                  Exercise Sequence
                </span>
              </div>
            </div>

            <RoutineTemplatesCard
              canEdit={true}
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
              onUpdateTemplate={updateTemplate}
            />
          </div>
        </div>
      </div>

      <AlertDialog open={blocker.state === "blocked"}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unsaved Changes</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes in your new routine. Are you sure you
              want to leave? Your progress will be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => blocker.reset?.()}>
              Stay
            </AlertDialogCancel>
            <AlertDialogAction onClick={() => blocker.proceed?.()}>
              Leave
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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

export default CreateRoutinePage;
