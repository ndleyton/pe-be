import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { createExerciseSet, CreateExerciseSetData, ExerciseSet, getIntensityUnits, IntensityUnit } from '../api/exercises';
import IntensityUnitModal from './IntensityUnitModal';

interface AddExerciseSetFormProps {
  exerciseId: number;
  onSetAdded: (newSet: ExerciseSet) => void;
  onCancel: () => void;
}

const AddExerciseSetForm: React.FC<AddExerciseSetFormProps> = ({ exerciseId, onSetAdded, onCancel }) => {
  const [formData, setFormData] = useState<CreateExerciseSetData>({
    exercise_id: exerciseId,
    intensity_unit_id: 1, // Default to first intensity unit (kg)
    reps: undefined,
    intensity: undefined,
    rest_time_seconds: undefined,
    done: false,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUnitModalOpen, setIsUnitModalOpen] = useState(false);

  const { data: intensityUnits = [], isLoading: isLoadingUnits } = useQuery({
    queryKey: ['intensityUnits'],
    queryFn: getIntensityUnits,
  });

  const currentUnit = intensityUnits.find(unit => unit.id === formData.intensity_unit_id) || intensityUnits[0];

  const handleUnitButtonClick = () => {
    setIsUnitModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const newSet = await createExerciseSet(formData);
      onSetAdded(newSet);
      // Reset form
      setFormData({
        exercise_id: exerciseId,
        intensity_unit_id: 1,
        reps: undefined,
        intensity: undefined,
        rest_time_seconds: undefined,
        done: false,
      });
      setIsUnitModalOpen(false);
    } catch (error) {
      console.error('Error creating exercise set:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUnitSelect = (unit: IntensityUnit) => {
    setFormData({ ...formData, intensity_unit_id: unit.id });
    setIsUnitModalOpen(false);
  };

  const handleCloseModal = () => {
    setIsUnitModalOpen(false);
  };

  return (
    <div className="bg-gray-700 border border-gray-600 rounded-lg p-4">
      <h4 className="text-white font-medium mb-3">Add New Set</h4>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="flex space-x-3">
          <div className="flex-1">
            <label htmlFor="reps" className="block text-gray-400 text-sm mb-1">Reps</label>
            <input
              type="number"
              min="0"
              id="reps"
              value={formData.reps || ''}
              onChange={(e) => setFormData({ ...formData, reps: e.target.value ? parseInt(e.target.value) : undefined })}
              className="w-full p-2 bg-gray-800 border border-gray-600 rounded text-white"
              placeholder="e.g., 10"
            />
          </div>
          <div className="flex-1 relative">
            <label htmlFor="intensity" className="block text-gray-400 text-sm mb-1">Weight</label>
            <div className="flex">
              <input
                type="number"
                step="0.1"
                min="0"
                id="intensity"
                value={formData.intensity || ''}
                onChange={(e) => setFormData({ ...formData, intensity: e.target.value ? parseFloat(e.target.value) : undefined })}
                className="flex-1 p-2 bg-gray-800 border border-gray-600 rounded-l text-white"
                placeholder="e.g., 50.5"
              />
              <button
                type="button"
                onClick={handleUnitButtonClick}
                className="px-3 py-2 bg-gray-600 border border-l-0 border-gray-600 rounded-r text-white text-sm hover:bg-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-400 select-none"
                aria-label={currentUnit ? `Current unit: ${currentUnit.name}. Click to change unit` : 'Loading units...'}
                disabled={isLoadingUnits || !currentUnit}
              >
                {isLoadingUnits ? '...' : (currentUnit?.abbreviation || 'kg')}
              </button>
            </div>
          </div>
          <div className="flex-1">
            <label htmlFor="rest-time" className="block text-gray-400 text-sm mb-1">Rest (seconds)</label>
            <input
              type="number"
              min="0"
              id="rest-time"
              value={formData.rest_time_seconds || ''}
              onChange={(e) => setFormData({ ...formData, rest_time_seconds: e.target.value ? parseInt(e.target.value) : undefined })}
              className="w-full p-2 bg-gray-800 border border-gray-600 rounded text-white"
              placeholder="e.g., 60"
            />
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            id="done"
            checked={formData.done}
            onChange={(e) => setFormData({ ...formData, done: e.target.checked })}
            className="text-blue-500"
          />
          <label htmlFor="done" className="text-white text-sm">Mark as completed</label>
        </div>

        <div className="flex space-x-2">
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {isSubmitting ? 'Adding...' : 'Add Set'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
          >
            Cancel
          </button>
        </div>
      </form>
      <IntensityUnitModal
        isOpen={isUnitModalOpen}
        onClose={handleCloseModal}
        onSelect={handleUnitSelect}
      />
    </div>
  );
};

export default AddExerciseSetForm;