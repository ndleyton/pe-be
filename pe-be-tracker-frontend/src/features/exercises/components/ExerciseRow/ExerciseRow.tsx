import { memo, useCallback, useState } from "react";

import { useExerciseRowState, useExerciseSetActions, useExerciseTypeStats } from "@/features/exercises/hooks";
import {
  getExerciseClientKey,
  type ExerciseRowProps,
} from "@/features/exercises/lib/exerciseRow";
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
import { ExerciseNotesInput } from "./ExerciseNotesInput";

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
  const exerciseKey = getExerciseClientKey(exercise);

  const isExpanded = isExpandedProp ?? isExpandedInternal;

  const {
    addSet,
    addLeftRightPair,
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
        onToggleExpand?.(exerciseKey);
      }
      return;
    }

    setIsExpandedInternal(nextExpanded);
    if (nextExpanded !== isExpanded) {
      onToggleExpand?.(exerciseKey);
    }
  }, [exerciseKey, isControlled, isExpanded, onToggleExpand]);

  const handleToggleExpand = useCallback(() => {
    handleExpandedChange(!isExpanded);
  }, [handleExpandedChange, isExpanded]);

  const handleAddSet = useCallback(() => {
    void addSet(currentIntensityUnit.id);
  }, [addSet, currentIntensityUnit.id]);

  const handleAddPair = useCallback(() => {
    void addLeftRightPair(currentIntensityUnit.id);
  }, [addLeftRightPair, currentIntensityUnit.id]);

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
          className={cn(
            "mx-auto w-full max-w-2xl overflow-hidden rounded-2xl border-border/5 border-t-4 border-b-4 shadow-lg backdrop-blur-sm shadow-black/5 transition-all duration-300 hover:shadow-xl gap-2",
            isExpanded
              ? "bg-highlight/10 border-t-highlight/30"
              : "bg-card/80 border-t-highlight/10",
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
            <ExerciseRowImagePanel exerciseType={exercise.exercise_type} />
            <div className="px-4 pt-2 pb-1">
              <ExerciseNotesInput
                id={`notes-${exerciseKey}`}
                value={exerciseNotesValue}
                onChange={setExerciseNotesValue}
                onSave={updateExerciseNotes}
              />
            </div>
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
              onAddPair={handleAddPair}
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
              onUpdateSetSide={(setId, side) => void updateSetOptions(setId, { side })}
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
