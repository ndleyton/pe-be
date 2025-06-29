import React from 'react';
import { calculateMuscleGroupSummary, MuscleGroupSummary, ExerciseTypeWithMuscles } from '@/utils/muscleGroups';

interface Exercise {
  exercise_type: ExerciseTypeWithMuscles | { name: string };
  exercise_sets: Array<{ done?: boolean }>;
}

interface FinishWorkoutModalProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
  exercises?: Exercise[];
}

const FinishWorkoutModal: React.FC<FinishWorkoutModalProps> = ({
  isOpen,
  onConfirm,
  onCancel,
  isLoading = false,
  exercises = [],
}) => {
  if (!isOpen) return null;

  // Calculate muscle group summary
  const muscleGroupSummary = calculateMuscleGroupSummary(exercises);
  const totalSets = muscleGroupSummary.reduce((sum, group) => sum + group.setCount, 0);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-800 text-gray-100 p-6 rounded-lg max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold mb-4">Finish Workout?</h2>
        <p className="mb-4 text-gray-300">
          Are you sure you want to finish this workout? This will set the end time to now.
        </p>

        {/* Muscle Group Summary */}
        {muscleGroupSummary.length > 0 && (
          <div className="mb-6 p-4 bg-gray-700 rounded-lg">
            <h3 className="text-lg font-semibold mb-3 text-green-400">
              🎉 Great work! You trained:
            </h3>
            <div className="space-y-2">
              {muscleGroupSummary.map((group) => (
                <div
                  key={group.name}
                  className="flex justify-between items-center py-2 px-3 bg-gray-600 rounded"
                >
                  <span className="font-medium">{group.name}</span>
                  <span className="text-blue-400 font-bold">
                    {group.setCount} set{group.setCount !== 1 ? 's' : ''}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-3 pt-3 border-t border-gray-600">
              <div className="flex justify-between items-center font-bold">
                <span>Total Sets Completed:</span>
                <span className="text-green-400 text-lg">{totalSets}</span>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex justify-end space-x-4">
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Finishing...' : 'Finish Workout'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default FinishWorkoutModal;