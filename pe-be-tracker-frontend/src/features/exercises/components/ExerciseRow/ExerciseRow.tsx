import { memo, useCallback, useState } from "react";

import { useExerciseRowState, useExerciseSetActions } from "@/features/exercises/hooks";
import type { ExerciseRowProps } from "@/features/exercises/lib/exerciseRow";
import { Card, CardContent, CardHeader } from "@/shared/components/ui";
import { cn } from "@/lib/utils";
import { ExerciseRowHeader } from "./ExerciseRowHeader";
import { ExerciseSetTable } from "./ExerciseSetTable";
import { ExerciseRowImagePanel } from "./ExerciseRowImagePanel";
import { 
  Accordion, 
  AccordionContent, 
  AccordionItem 
} from "@/shared/components/ui/accordion";

const ExerciseRow = ({
  exercise,
  onExerciseDelete,
  onExerciseUpdate,
  workoutId,
  isExpanded: isExpandedProp,
  onToggleExpand,
}: ExerciseRowProps) => {
  const [isExpandedInternal, setIsExpandedInternal] = useState(false);

  const isExpanded = isExpandedProp ?? isExpandedInternal;

  const {
    addSet,
    decrementReps,
    deleteSet,
    exerciseSets,
    handleExerciseDelete,
    incrementReps,
    isUnsavedExercise,
    toggleSetCompletion,
    updateExerciseNotes,
    updateSetField,
    updateSetNotes,
  } = useExerciseSetActions({
    exercise,
    onExerciseDelete,
    onExerciseUpdate,
    workoutId,
  });

  const {
    activeSetId,
    currentIntensityUnit,
    exerciseNotesOpen,
    exerciseNotesValue,
    exerciseSettingsOpen,
    handleExerciseNotesOpenChange,
    handleIntensityUnitChange,
    handleSetOptionsOpenChange,
    intensityInputs,
    openExerciseNotes,
    openSetOptions,
    repsInputs,
    setExerciseNotesValue,
    setExerciseSettingsOpen,
    setIntensityInputValue,
    setNotesValue,
    setRepsInputValue,
    setSetNotesValue,
    closeSetOptions,
  } = useExerciseRowState({
    exercise,
    exerciseSets,
    updateSetNotes,
  });

  const hasImages = 
    (exercise.exercise_type.status ?? "released") === "released" && 
    (exercise.exercise_type.images?.length ?? 0) > 0;

  const handleExpandedChange = useCallback((nextExpanded: boolean) => {
    if (onToggleExpand) {
      if (nextExpanded !== isExpanded) {
        onToggleExpand(exercise.id);
      }
      return;
    }

    setIsExpandedInternal(nextExpanded);
  }, [exercise.id, isExpanded, onToggleExpand]);

  const handleToggleExpand = useCallback(() => {
    handleExpandedChange(!isExpanded);
  }, [handleExpandedChange, isExpanded]);

  return (
    <Accordion 
      type="single" 
      collapsible 
      value={isExpanded ? "images" : ""}
      onValueChange={(value: string) => {
        handleExpandedChange(value === "images");
      }}
    >
      <AccordionItem value="images" className="border-none">
        <Card
          key={exercise.id}
          className={cn(
            "overflow-hidden rounded-2xl border-border/5 border-t-4 border-b-4 shadow-lg backdrop-blur-sm shadow-black/5 transition-all duration-300 hover:shadow-xl",
            isExpanded
              ? "bg-rose-500/10 border-t-rose-500/30"
              : "bg-card/80 border-t-rose-500/10",
          )}
        >
          <CardHeader className="pb-2">
            <ExerciseRowHeader
              currentIntensityUnit={currentIntensityUnit}
              exercise={exercise}
              exerciseNotesOpen={exerciseNotesOpen}
              exerciseNotesValue={exerciseNotesValue}
              exerciseSettingsOpen={exerciseSettingsOpen}
              isUnsavedExercise={isUnsavedExercise}
              isExpanded={isExpanded}
              onToggleExpand={handleToggleExpand}
              hasImages={hasImages}
              onExerciseDelete={handleExerciseDelete}
              onExerciseNotesOpen={openExerciseNotes}
              onExerciseNotesOpenChange={handleExerciseNotesOpenChange}
              onExerciseNotesSave={() => {
                updateExerciseNotes(exerciseNotesValue);
                handleExerciseNotesOpenChange(false);
              }}
              onExerciseNotesValueChange={setExerciseNotesValue}
              onExerciseSettingsOpenChange={setExerciseSettingsOpen}
              onIntensityUnitChange={handleIntensityUnitChange}
            />
          </CardHeader>

          <AccordionContent className="p-0">
            <ExerciseRowImagePanel exerciseType={exercise.exercise_type} />
          </AccordionContent>

          <CardContent className="p-4 pt-0">
            <ExerciseSetTable
              activeSetId={activeSetId}
              currentIntensityUnitAbbreviation={currentIntensityUnit.abbreviation}
              currentIntensityUnitId={currentIntensityUnit.id}
              exerciseSets={exerciseSets}
              intensityInputs={intensityInputs}
              isUnsavedExercise={isUnsavedExercise}
              onAddSet={() => void addSet(currentIntensityUnit.id)}
              onCloseSetOptions={closeSetOptions}
              onDecrementReps={decrementReps}
              onDeleteSet={deleteSet}
              onIncrementReps={incrementReps}
              onOpenSetOptions={openSetOptions}
              onSetOptionsOpenChange={handleSetOptionsOpenChange}
              onSetNotesValueChange={setSetNotesValue}
              onSetRepsInputValue={setRepsInputValue}
              onSetWeightInputValue={setIntensityInputValue}
              onToggleSetCompletion={toggleSetCompletion}
              onUpdateSetField={updateSetField}
              repsInputs={repsInputs}
              setNotesValue={setNotesValue}
            />
          </CardContent>
        </Card>
      </AccordionItem>
    </Accordion>
  );
};

export default memo(ExerciseRow);
