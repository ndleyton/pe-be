import { memo } from "react";

import { useExerciseRowState, useExerciseSetActions } from "@/features/exercises/hooks";
import type { ExerciseRowProps } from "@/features/exercises/lib/exerciseRow";
import { Card, CardContent, CardHeader } from "@/shared/components/ui";
import { ExerciseRowHeader } from "./ExerciseRowHeader";
import { ExerciseSetTable } from "./ExerciseSetTable";

const ExerciseRow = ({
  exercise,
  onExerciseDelete,
  onExerciseUpdate,
  workoutId,
}: ExerciseRowProps) => {
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

  return (
    <Card key={exercise.id} className="border-input">
      <CardHeader className="pb-2">
        <ExerciseRowHeader
          currentIntensityUnit={currentIntensityUnit}
          exercise={exercise}
          exerciseNotesOpen={exerciseNotesOpen}
          exerciseNotesValue={exerciseNotesValue}
          exerciseSettingsOpen={exerciseSettingsOpen}
          isUnsavedExercise={isUnsavedExercise}
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
  );
};

export default memo(ExerciseRow);
