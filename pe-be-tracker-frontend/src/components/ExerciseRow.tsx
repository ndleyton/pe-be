import React from 'react';
import { Exercise } from '../api/exercises';

interface ExerciseRowProps {
  exercise: Exercise;
}

const ExerciseRow: React.FC<ExerciseRowProps> = ({ exercise }) => {
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 hover:bg-gray-750 transition-colors">
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
      </div>
    </div>
  );
};

export default ExerciseRow;