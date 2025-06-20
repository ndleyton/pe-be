import React from 'react';

interface FinishWorkoutModalProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
}

const FinishWorkoutModal: React.FC<FinishWorkoutModalProps> = ({
  isOpen,
  onConfirm,
  onCancel,
  isLoading = false,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-800 text-gray-100 p-6 rounded-lg max-w-md w-full mx-4">
        <h2 className="text-xl font-bold mb-4">Finish Workout?</h2>
        <p className="mb-6 text-gray-300">
          Are you sure you want to finish this workout? This will set the end time to now.
        </p>
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