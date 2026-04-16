import { memo, useCallback, useState } from "react";

import { useExerciseRowState, useExerciseSetActions, useExerciseTypeStats } from "@/features/exercises/hooks";
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
import { Textarea } from "@/shared/components/ui/textarea";

const ExerciseRow = ({
  exercise,
  onExerciseDelete,
  onExerciseUpdate,
  workoutId,
  isExpanded: isExpandedProp,
  onToggleExpand,
}: ExerciseRowProps) => {
  const [isExpandedInternal, setIsExpandedInternal] = useState(false);
  const isControlled = isExpandedProp !== undefined;

  const isExpanded = isExpandedProp ?? isExpandedInternal;

  const {
    addSet,
    decrementReps,
    deleteSet,
    exerciseSets,
    handleExerciseDelete,
    incrementReps,
    isUnsavedExercise,
    setSetValueMode,
    toggleSetCompletion,
    updateExerciseNotes,
    updateSetField,
    updateSetOptions,
  } = useExerciseSetActions({
    exercise,
    onExerciseDelete,
    onExerciseUpdate,
    workoutId,
  });

  const {
    activeSetId,
    currentIntensityUnit,
    durationInputs,
    exerciseNotesValue,
    exerciseSettingsOpen,
    handleIntensityUnitChange,
    handleSetOptionsOpenChange,
    intensityInputs,
    openSetOptions,
    repsInputs,
    setDurationInputValue,
    setExerciseNotesValue,
    setExerciseSettingsOpen,
    setIntensityInputValue,
    setNotesValue,
    setRpeValue,
    setRirValue,
    setRepsInputValue,
    setSetRpeValue,
    setSetRirValue,
    setSetNotesValue,
    closeSetOptions,
  } = useExerciseRowState({
    exercise,
    exerciseSets,
    updateSetOptions,
  });

  const { stats } = useExerciseTypeStats(exercise.exercise_type.id, exercise.exercise_type);


  const handleExpandedChange = useCallback((nextExpanded: boolean) => {
    if (isControlled) {
      if (nextExpanded !== isExpanded) {
        onToggleExpand?.(exercise.id);
      }
      return;
    }

    setIsExpandedInternal(nextExpanded);
    if (nextExpanded !== isExpanded) {
      onToggleExpand?.(exercise.id);
    }
  }, [exercise.id, isControlled, isExpanded, onToggleExpand]);

  const handleToggleExpand = useCallback(() => {
    handleExpandedChange(!isExpanded);
  }, [handleExpandedChange, isExpanded]);

  const handleAddSet = useCallback(() => {
    void addSet(currentIntensityUnit.id);
  }, [addSet, currentIntensityUnit.id]);

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
            "mx-auto w-full max-w-2xl overflow-hidden rounded-2xl border-border/5 border-t-4 border-b-4 shadow-lg backdrop-blur-sm shadow-black/5 transition-all duration-300 hover:shadow-xl",
            isExpanded
              ? "bg-rose-500/10 border-t-rose-500/30"
              : "bg-card/80 border-t-rose-500/10",
          )}
        >
          <CardHeader className="pb-2">
            <ExerciseRowHeader
              currentIntensityUnit={currentIntensityUnit}
              exercise={exercise}
              exerciseNotesValue={exerciseNotesValue}
              exerciseSettingsOpen={exerciseSettingsOpen}
              isUnsavedExercise={isUnsavedExercise}
              isExpanded={isExpanded}
              onToggleExpand={handleToggleExpand}
              onExerciseDelete={handleExerciseDelete}
              onExerciseSettingsOpenChange={setExerciseSettingsOpen}
              onIntensityUnitChange={handleIntensityUnitChange}
            />
          </CardHeader>

          <AccordionContent className="p-0">
            <div className="px-4 pb-2 pt-2">
              <Textarea
                id={`notes-${exercise.id}`}
                aria-label="Exercise notes"
                placeholder="Add exercise notes..."
                value={exerciseNotesValue}
                onChange={(e) => setExerciseNotesValue(e.target.value)}
                onBlur={() => updateExerciseNotes(exerciseNotesValue)}
                className="min-h-[60px] bg-background/50 resize-none text-sm border-dashed"
              />
            </div>
            <ExerciseRowImagePanel exerciseType={exercise.exercise_type} />
          </AccordionContent>

          <CardContent className="p-4 pt-0">
            <ExerciseSetTable
              activeSetId={activeSetId}
              currentIntensityUnitAbbreviation={currentIntensityUnit.abbreviation}
              currentIntensityUnitId={currentIntensityUnit.id}
              durationInputs={durationInputs}
              exerciseSets={exerciseSets}
              intensityInputs={intensityInputs}
              isUnsavedExercise={isUnsavedExercise}
              onAddSet={handleAddSet}
              onCloseSetOptions={closeSetOptions}
              onDecrementReps={decrementReps}
              onDeleteSet={deleteSet}
              onIncrementReps={incrementReps}
              onOpenSetOptions={openSetOptions}
              onSetOptionsOpenChange={handleSetOptionsOpenChange}
              onSetDurationInputValue={setDurationInputValue}
              onSetNotesValueChange={setSetNotesValue}
              onSetRpeValueChange={setSetRpeValue}
              onSetRirValueChange={setSetRirValue}
              onSetRepsInputValue={setRepsInputValue}
              onSetValueModeChange={setSetValueMode}
              onSetWeightInputValue={setIntensityInputValue}
              onToggleSetCompletion={toggleSetCompletion}
              onUpdateSetField={updateSetField}
              repsInputs={repsInputs}
              setNotesValue={setNotesValue}
              setRpeValue={setRpeValue}
              setRirValue={setRirValue}
              personalBest={stats?.personalBest}
              personalBestUnitId={stats?.intensityUnit?.id}
            />
          </CardContent>
        </Card>
      </AccordionItem>
    </Accordion>
  );
};

export default memo(ExerciseRow);
