import React, { useState } from 'react';
import { Exercise, ExerciseSet } from '@/features/exercises/api';
import { GuestExerciseSet } from '@/contexts/GuestDataContext';
import { ExerciseSetRow, AddExerciseSetForm } from '@/features/exercise-sets/components';
import { formatDisplayDate } from '@/utils/date';

interface ExerciseRowProps {
  exercise: Exercise;
  onExerciseUpdate?: (updatedExercise: Exercise) => void;
  workoutId?: string;
}

const ExerciseRow: React.FC<ExerciseRowProps> = ({ exercise, onExerciseUpdate, workoutId }) => {
  const [exerciseSets, setExerciseSets] = useState<ExerciseSet[]>(exercise.exercise_sets || []);
  const [showAddForm, setShowAddForm] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const handleSetAdded = (newSet: ExerciseSet | GuestExerciseSet) => {
    const updatedSets = [...exerciseSets, newSet];
    setExerciseSets(updatedSets);
    setShowAddForm(false);
    
    // Update the parent with the updated exercise
    if (onExerciseUpdate) {
      onExerciseUpdate({
        ...exercise,
        exercise_sets: updatedSets
      });
    }
  };

  const handleSetUpdate = (updatedSet: ExerciseSet) => {
    const updatedSets = exerciseSets.map(set => 
      set.id === updatedSet.id ? updatedSet : set
    );
    setExerciseSets(updatedSets);
    
    // Update the parent with the updated exercise
    if (onExerciseUpdate) {
      onExerciseUpdate({
        ...exercise,
        exercise_sets: updatedSets
      });
    }
  };

  const handleSetDelete = (setId: number | string) => {
    const updatedSets = exerciseSets.filter(set => set.id !== setId);
    setExerciseSets(updatedSets);
    
    // Update the parent with the updated exercise
    if (onExerciseUpdate) {
      onExerciseUpdate({
        ...exercise,
        exercise_sets: updatedSets
      });
    }
  };

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      {/* Exercise Header */}
      <div className="p-4 hover:bg-accent transition-colors">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-sm">
                  {exercise.exercise_type.name.charAt(0).toUpperCase()}
                </span>
              </div>
              <div>
                <h4 className="text-foreground font-medium">
                  {exercise.exercise_type.name}
                </h4>
                {exercise.exercise_type.description && (
                  <p className="text-muted-foreground text-xs mt-0.5">
                    {exercise.exercise_type.description}
                  </p>
                )}
                {exercise.notes && (
                  <p className="text-muted-foreground text-sm mt-1">
                    {exercise.notes}
                  </p>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <div className="text-right text-sm text-muted-foreground">
              {exercise.timestamp ? (
                <div>
                  {formatDisplayDate(exercise.timestamp, { timeStyle: 'short', includeTimezone: false })}
                </div>
              ) : (
                <div>
                  Created: {formatDisplayDate(exercise.created_at, { timeStyle: 'short', includeTimezone: false })}
                </div>
              )}
            </div>
            <div className="flex items-center space-x-2">
              {exerciseSets.length > 0 && (
                <button
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="text-muted-foreground hover:text-foreground text-sm"
                >
                  {isExpanded ? '▲' : `▼ ${exerciseSets.length} sets`}
                </button>
              )}
              <button
                onClick={() => setShowAddForm(!showAddForm)}
                className="w-8 h-8 bg-primary hover:bg-primary/90 rounded-full flex items-center justify-center text-primary-foreground transition-colors"
                title="Add set"
              >
                +
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Exercise Sets Section */}
      {(isExpanded || showAddForm) && (
        <div className="border-t border-border bg-background/50">
          {/* Add Set Form */}
          {showAddForm && (
            <div className="p-4 border-b border-border">
              <AddExerciseSetForm
                exerciseId={exercise.id}
                onSetAdded={handleSetAdded}
                onCancel={() => setShowAddForm(false)}
              />
            </div>
          )}

          {/* Exercise Sets List */}
          {isExpanded && exerciseSets.length > 0 && (
            <div className="p-4 space-y-2">
              <h5 className="text-muted-foreground text-sm font-medium mb-2">Sets ({exerciseSets.length})</h5>
              {exerciseSets.map((set) => (
                <ExerciseSetRow
                  key={set.id}
                  exerciseSet={set}
                  onUpdate={handleSetUpdate}
                  onDelete={handleSetDelete}
                  workoutId={workoutId}
                />
              ))}
            </div>
          )}

          {/* Empty state when expanded but no sets */}
          {isExpanded && exerciseSets.length === 0 && (
            <div className="p-4 text-center text-muted-foreground">
              No sets added yet. Click the + button to add your first set.
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ExerciseRow;