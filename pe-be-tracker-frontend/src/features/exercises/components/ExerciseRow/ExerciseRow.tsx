import React, { useState } from 'react';
import { Exercise, ExerciseSet } from '../../../../api/exercises';
import { GuestExerciseSet } from '../../../../contexts/GuestDataContext';
import { ExerciseSetRow, AddExerciseSetForm } from '../../../exercise-sets/components';

interface ExerciseRowProps {
  exercise: Exercise;
  onExerciseUpdate?: (updatedExercise: Exercise) => void;
}

const ExerciseRow: React.FC<ExerciseRowProps> = ({ exercise, onExerciseUpdate }) => {
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
    <div className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
      {/* Exercise Header */}
      <div className="p-4 hover:bg-gray-700 transition-colors">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">
                  {exercise.exercise_type.name.charAt(0).toUpperCase()}
                </span>
              </div>
              <div>
                <h4 className="text-white font-medium">
                  {exercise.exercise_type.name}
                </h4>
                {exercise.exercise_type.description && (
                  <p className="text-gray-500 text-xs mt-0.5">
                    {exercise.exercise_type.description}
                  </p>
                )}
                {exercise.notes && (
                  <p className="text-gray-400 text-sm mt-1">
                    {exercise.notes}
                  </p>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <div className="text-right text-sm text-gray-400">
              {exercise.timestamp ? (
                <div>
                  {new Date(exercise.timestamp).toLocaleString()}
                </div>
              ) : (
                <div>
                  Created: {new Date(exercise.created_at).toLocaleString()}
                </div>
              )}
            </div>
            <div className="flex items-center space-x-2">
              {exerciseSets.length > 0 && (
                <button
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="text-gray-400 hover:text-white text-sm"
                >
                  {isExpanded ? '▲' : `▼ ${exerciseSets.length} sets`}
                </button>
              )}
              <button
                onClick={() => setShowAddForm(!showAddForm)}
                className="w-8 h-8 bg-green-600 hover:bg-green-700 rounded-full flex items-center justify-center text-white transition-colors"
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
        <div className="border-t border-gray-700 bg-gray-750">
          {/* Add Set Form */}
          {showAddForm && (
            <div className="p-4 border-b border-gray-600">
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
              <h5 className="text-gray-400 text-sm font-medium mb-2">Sets ({exerciseSets.length})</h5>
              {exerciseSets.map((set) => (
                <ExerciseSetRow
                  key={set.id}
                  exerciseSet={set}
                  onUpdate={handleSetUpdate}
                  onDelete={handleSetDelete}
                />
              ))}
            </div>
          )}

          {/* Empty state when expanded but no sets */}
          {isExpanded && exerciseSets.length === 0 && (
            <div className="p-4 text-center text-gray-500">
              No sets added yet. Click the + button to add your first set.
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ExerciseRow;