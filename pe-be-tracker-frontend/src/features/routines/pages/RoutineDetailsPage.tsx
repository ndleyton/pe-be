import { ArrowLeft, Eye } from "lucide-react";
import { useCallback, useState } from "react";
import { useBlocker, useParams } from "react-router-dom";

import {
  ExerciseTypeModal,
  IntensityUnitModal,
} from "@/features/exercises/components";
import {
  RoutineInfoCard,
  RoutineTemplatesCard,
  RoutineDetailsPageSkeleton,
} from "@/features/routines/components";
import { RoutineStructuredData } from "@/features/routines/components/RoutineStructuredData/RoutineStructuredData";
import {
  useRoutineDetailsActions,
  useRoutineDetailsData,
  useRoutineEditor,
} from "@/features/routines/hooks";
import { buildRoutineExercisePlanJsonLd } from "@/features/routines/lib/routineStructuredData";
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
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { useAppBackNavigation } from "@/shared/hooks/useAppBackNavigation";

const RoutineDetailsPage = () => {
  const { routineId } = useParams();
  const [isEditing, setIsEditing] = useState(false);
  const handleBack = useAppBackNavigation("/routines");

  const {
    availableIntensityUnits,
    canEdit,
    editAccessMessage,
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
    visibility,
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
    setName,
    updateSet,
    updateTemplate,
  } = useRoutineEditor({
    availableIntensityUnits,
    routine,
  });

  const { deleteMutation, handleDelete, saveMutation, startMutation } =
    useRoutineDetailsActions({
      canEdit,
      description,
      editorTemplates,
      isAuthenticated,
      name,
      visibility,
      routine,
      routineId,
    });

  // Guard for unsaved changes
  const blocker = useBlocker(
    useCallback(
      () => isEditing && hasUnsavedChanges,
      [isEditing, hasUnsavedChanges]
    )
  );
  const isPageDataPending = routinePending && !routine;
  const showUnavailableState = !isPageDataPending && (routineError || !routine);

  const actionError =
    saveMutation.error ?? startMutation.error ?? deleteMutation.error;
  const routineJsonLd = routine ? buildRoutineExercisePlanJsonLd(routine) : null;

  const handleSave = async () => {
    await saveMutation.mutateAsync();
    setIsEditing(false);
  };

  const handleCancel = () => {
    if (hasUnsavedChanges) {
      if (confirm("You have unsaved changes. Are you sure you want to cancel?")) {
        setIsEditing(false);
      }
    } else {
      setIsEditing(false);
    }
  };

  return (
    <>
      {routineJsonLd ? <RoutineStructuredData data={routineJsonLd} /> : null}
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
            <div className="flex min-w-0 flex-wrap items-center gap-3">
              <h1 className="min-w-0 truncate bg-gradient-to-b from-foreground to-foreground/70 bg-clip-text text-3xl font-black tracking-tight text-transparent text-glow">
                {isPageDataPending
                  ? "Routine Details"
                  : canEdit || isEditing
                    ? "Routine Editor"
                    : "Routine Details"}
              </h1>
              {editAccessMessage && !isEditing && !isPageDataPending && (
                <Badge
                  variant="secondary"
                  className="flex h-fit shrink-0 gap-1.5 rounded-lg border-primary/20 bg-primary/5 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-primary hover:bg-primary/10"
                >
                  <Eye className="h-3 w-3" />
                  View-only
                </Badge>
              )}
            </div>
            <p className="mt-1 text-xs font-bold uppercase tracking-widest text-muted-foreground/70">
              {isEditing ? "Management Mode" : "Plan Overview"}
            </p>
          </div>
        </div>

        <div className="grid gap-8 text-left">
          {showUnavailableState ? (
            <Alert variant="destructive">
              <AlertTitle>Routine unavailable</AlertTitle>
              <AlertDescription>
                We couldn&apos;t load this routine. It may have been deleted or
                you may not have access to it.
              </AlertDescription>
            </Alert>
          ) : null}

          {actionError && !showUnavailableState && (
            <Alert
              variant="destructive"
              className="rounded-2xl border-destructive/20 bg-destructive/5 backdrop-blur-md"
            >
              <AlertTitle className="text-xs font-bold uppercase tracking-wider">
                Action failed
              </AlertTitle>
              <AlertDescription className="text-sm">
                {actionError instanceof Error
                  ? actionError.message
                  : "Something went wrong while updating the routine."}
              </AlertDescription>
            </Alert>
          )}

          {!showUnavailableState && isPageDataPending && (
            <RoutineDetailsPageSkeleton />
          )}

          {!showUnavailableState && !isPageDataPending ? (
            <div className="space-y-8">
              <RoutineInfoCard
                canEdit={canEdit}
                editDisabled={unitsPending}
                editLabel={unitsPending ? "Preparing editor..." : "Edit Routine"}
                isEditing={isEditing}
                deleteDisabled={deleteMutation.isPending}
                deleteLabel={
                  deleteMutation.isPending ? "Deleting..." : "Delete Routine"
                }
                description={description}
                hasInvalidTemplates={hasInvalidTemplates}
                name={name}
                visibility={visibility}
                onDelete={handleDelete}
                onDescriptionChange={setDescription}
                onNameChange={setName}
                onVisibilityChange={setVisibility}
                onSave={handleSave}
                onStartWorkout={() => startMutation.mutate()}
                onEdit={() => {
                  if (unitsPending) {
                    return;
                  }
                  setIsEditing(true);
                }}
                onCancel={handleCancel}
                saveDisabled={
                  hasInvalidTemplates ||
                  !hasUnsavedChanges ||
                  saveMutation.isPending
                }
                saveLabel={saveMutation.isPending ? "Saving..." : "Save Routine"}
                startDisabled={startMutation.isPending}
                startLabel={
                  startMutation.isPending ? "Starting..." : "Start Workout"
                }
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
                canEdit={isEditing}
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
          ) : null}
        </div>
      </div>

      <AlertDialog open={blocker.state === "blocked"}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unsaved Changes</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes in the routine editor. Are you sure you
              want to leave? Your changes will be lost.
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

export default RoutineDetailsPage;
