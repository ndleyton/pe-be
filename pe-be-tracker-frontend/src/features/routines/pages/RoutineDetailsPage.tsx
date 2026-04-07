import { ArrowLeft, Eye } from "lucide-react";
import { useCallback, useState } from "react";
import { Link, useBlocker, useParams } from "react-router-dom";

import {
  ExerciseTypeModal,
  IntensityUnitModal,
} from "@/features/exercises/components";
import {
  RoutineInfoCard,
  RoutineTemplatesCard,
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
import { Card, CardContent } from "@/shared/components/ui/card";
import { Skeleton } from "@/shared/components/ui/skeleton";

const RoutineInfoCardSkeleton = () => (
  <Card className="bg-card/80 border-border/40 rounded-2xl border p-2 text-left shadow-xl backdrop-blur-md overflow-hidden">
    <CardContent className="grid gap-6 p-6">
      <div className="space-y-3">
        <Skeleton className="h-3 w-28 rounded-full" />
        <Skeleton className="h-8 w-52 rounded-xl" />
        <Skeleton className="h-4 w-full rounded-full" />
        <Skeleton className="h-4 w-3/4 rounded-full" />
      </div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Skeleton className="h-14 flex-1 rounded-xl" />
        <Skeleton className="h-14 flex-1 rounded-xl" />
        <Skeleton className="h-14 flex-1 rounded-xl" />
      </div>
    </CardContent>
  </Card>
);

const RoutineTemplatesCardSkeleton = () => (
  <Card className="bg-card/80 border-border/40 rounded-2xl border p-2 text-left shadow-xl backdrop-blur-md overflow-hidden">
    <CardContent className="space-y-6 p-6">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-3 w-32 rounded-full" />
          <Skeleton className="h-6 w-48 rounded-xl" />
        </div>
        <Skeleton className="h-10 w-32 rounded-xl" />
      </div>

      {Array.from({ length: 2 }).map((_, index) => (
        <div
          key={index}
          className="rounded-2xl border border-border/40 bg-muted/20 p-5 shadow-sm"
        >
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-4">
              <Skeleton className="h-12 w-12 rounded-xl" />
              <div className="space-y-3">
                <Skeleton className="h-6 w-40 rounded-xl" />
                <Skeleton className="h-5 w-16 rounded-full" />
                <Skeleton className="h-4 w-56 rounded-full" />
              </div>
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-9 w-20 rounded-xl" />
              <Skeleton className="h-9 w-20 rounded-xl" />
            </div>
          </div>

          <div className="space-y-3">
            {Array.from({ length: 2 }).map((_, setIndex) => (
              <div
                key={setIndex}
                className="rounded-xl border border-border/30 bg-background/50 p-4 shadow-sm backdrop-blur-sm"
              >
                <div className="mb-4 flex items-center justify-between gap-3 border-b border-border/10 pb-3">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-6 w-6 rounded-full" />
                    <Skeleton className="h-4 w-24 rounded-full" />
                  </div>
                  <Skeleton className="h-8 w-20 rounded-lg" />
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <Skeleton className="h-10 w-full rounded-xl" />
                  <Skeleton className="h-10 w-full rounded-xl" />
                  <Skeleton className="h-10 w-full rounded-xl" />
                </div>
              </div>
            ))}
          </div>

          <Skeleton className="mt-4 h-10 w-full rounded-xl" />
        </div>
      ))}
    </CardContent>
  </Card>
);

const RoutineDetailsPage = () => {
  const { routineId } = useParams();
  const [isEditing, setIsEditing] = useState(false);

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
            asChild
            aria-label="Go back"
            className="rounded-full bg-primary/5 hover:bg-primary hover:text-primary-foreground transition-all duration-300"
          >
            <Link to="/routines">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-black tracking-tight text-glow bg-gradient-to-b from-foreground to-foreground/70 bg-clip-text text-transparent truncate">
                {isPageDataPending
                  ? "Routine Details"
                  : canEdit || isEditing
                    ? "Routine Editor"
                    : "Routine Details"}
              </h1>
              {editAccessMessage && !isEditing && !isPageDataPending && (
                <Badge
                  variant="secondary"
                  className="rounded-lg bg-primary/5 hover:bg-primary/10 border-primary/20 text-primary px-2 py-0.5 text-[10px] font-black uppercase tracking-widest gap-1.5 flex h-fit"
                >
                  <Eye className="h-3 w-3" />
                  View-only
                </Badge>
              )}
            </div>
            <p className="text-muted-foreground/70 mt-1 text-xs font-bold uppercase tracking-widest">
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

          {editAccessMessage && !isEditing && !isPageDataPending && !showUnavailableState && (
            <Alert className="bg-primary/5 border-primary/20 rounded-2xl backdrop-blur-md">
              <AlertTitle className="text-xs font-bold uppercase tracking-wider opacity-70">View-only routine</AlertTitle>
              <AlertDescription className="text-sm italic">{editAccessMessage}</AlertDescription>
            </Alert>
          )}

          {actionError && !showUnavailableState && (
            <Alert variant="destructive" className="rounded-2xl border-destructive/20 bg-destructive/5 backdrop-blur-md">
              <AlertTitle className="text-xs font-bold uppercase tracking-wider">Action failed</AlertTitle>
              <AlertDescription className="text-sm">
                {actionError instanceof Error
                  ? actionError.message
                  : "Something went wrong while updating the routine."}
              </AlertDescription>
            </Alert>
          )}

          {!showUnavailableState ? (
            <div className="space-y-8">
              {isPageDataPending ? (
                <RoutineInfoCardSkeleton />
              ) : (
                <RoutineInfoCard
                  canEdit={canEdit}
                  editDisabled={unitsPending}
                  editLabel={unitsPending ? "Preparing editor..." : "Edit Routine"}
                  isEditing={isEditing}
                  deleteDisabled={deleteMutation.isPending}
                  deleteLabel={deleteMutation.isPending ? "Deleting..." : "Delete Routine"}
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
                    hasInvalidTemplates || !hasUnsavedChanges || saveMutation.isPending
                  }
                  saveLabel={saveMutation.isPending ? "Saving..." : "Save Routine"}
                  startDisabled={startMutation.isPending}
                  startLabel={startMutation.isPending ? "Starting..." : "Start Workout"}
                />
              )}

              <div className="relative">
                <div className="absolute inset-0 flex items-center" aria-hidden="true">
                  <div className="w-full border-t border-border/40"></div>
                </div>
                <div className="relative flex justify-center text-xs font-bold uppercase tracking-widest">
                  <span className="bg-background px-4 text-muted-foreground/40">Exercise Sequence</span>
                </div>
              </div>

              {isPageDataPending ? (
                <RoutineTemplatesCardSkeleton />
              ) : (
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
              )}
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
