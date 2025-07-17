import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { createExerciseSet, CreateExerciseSetData, ExerciseSet, getIntensityUnits, IntensityUnit } from '@/features/exercises/api';
import { IntensityUnitModal } from '@/features/exercises/components';
import { useGuestData, GuestExerciseSet } from '@/contexts/GuestDataContext';

interface AddExerciseSetFormProps {
  exerciseId: number | string; // Can be number (server) or string (guest)
  onSetAdded: (newSet: ExerciseSet | GuestExerciseSet) => void;
  onCancel: () => void;
}

const AddExerciseSetForm: React.FC<AddExerciseSetFormProps> = ({ exerciseId, onSetAdded, onCancel }) => {
  const { isAuthenticated, actions: guestActions } = useGuestData();
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
    enabled: isAuthenticated(), // Only fetch when authenticated
  });

  // For guest mode, use hardcoded intensity units
  const guestIntensityUnits = [
    { id: 1, name: 'Bodyweight', abbreviation: 'bw' },
    { id: 2, name: 'Kilograms', abbreviation: 'kg' },
    { id: 3, name: 'Pounds', abbreviation: 'lbs' },
  ];

  const currentIntensityUnits = isAuthenticated() ? intensityUnits : guestIntensityUnits;

  const currentUnit = currentIntensityUnits.find(unit => unit.id === formData.intensity_unit_id) || currentIntensityUnits[0];

  const handleUnitButtonClick = () => {
    setIsUnitModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      if (isAuthenticated()) {
        // Use API for authenticated users
        const newSet = await createExerciseSet(formData);
        onSetAdded(newSet);
      } else {
        // Use guest context for unauthenticated users
        const newSetId = guestActions.addExerciseSet({
          reps: formData.reps ?? null,
          intensity: formData.intensity ?? null,
          intensity_unit_id: formData.intensity_unit_id,
          exercise_id: exerciseId as string,
          rest_time_seconds: formData.rest_time_seconds ?? null,
          done: formData.done ?? false,
        });

        // Create a mock guest exercise set for the callback
        const newGuestSet: GuestExerciseSet = {
          id: newSetId,
          reps: formData.reps ?? null,
          intensity: formData.intensity ?? null,
          intensity_unit_id: formData.intensity_unit_id,
          exercise_id: exerciseId as string,
          rest_time_seconds: formData.rest_time_seconds ?? null,
          done: formData.done ?? false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        onSetAdded(newGuestSet);
      }

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

  const handleUnitSelect = (unit: IntensityUnit | any) => {
    setFormData({ ...formData, intensity_unit_id: unit.id });
    setIsUnitModalOpen(false);
  };

  const handleCloseModal = () => {
    setIsUnitModalOpen(false);
  };

  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <h4 className="text-foreground font-medium mb-3">Add New Set</h4>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="flex space-x-3">
          <div className="flex-1">
            <label htmlFor="reps" className="block text-muted-foreground text-sm mb-1">Reps</label>
            <input
              type="number"
              min="0"
              id="reps"
              value={formData.reps || ''}
              onChange={(e) => setFormData({ ...formData, reps: e.target.value ? parseInt(e.target.value) : undefined })}
              className="w-full p-2 bg-background border border-border rounded text-foreground"
              placeholder="e.g., 10"
            />
          </div>
          <div className="flex-1 relative">
            <label htmlFor="intensity" className="block text-muted-foreground text-sm mb-1">Weight</label>
            <div className="flex">
              <input
                type="number"
                step="0.1"
                min="0"
                id="intensity"
                value={formData.intensity || ''}
                onChange={(e) => setFormData({ ...formData, intensity: e.target.value ? parseFloat(e.target.value) : undefined })}
                className="flex-1 p-2 bg-background border border-border rounded-l text-foreground"
                placeholder="e.g., 50.5"
              />
              <button
                type="button"
                onClick={handleUnitButtonClick}
                className="px-3 py-2 bg-muted border border-l-0 border-border rounded-r text-muted-foreground text-sm hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring select-none"
                aria-label={currentUnit ? `Current unit: ${currentUnit.name}. Click to change unit` : 'Loading units...'}
                disabled={(isAuthenticated() && isLoadingUnits) || !currentUnit}
              >
                {(isAuthenticated() && isLoadingUnits) ? '...' : (currentUnit?.abbreviation || 'kg')}
              </button>
            </div>
          </div>
          <div className="flex-1">
            <label htmlFor="rest-time" className="block text-muted-foreground text-sm mb-1">Rest (seconds)</label>
            <input
              type="number"
              min="0"
              id="rest-time"
              value={formData.rest_time_seconds || ''}
              onChange={(e) => setFormData({ ...formData, rest_time_seconds: e.target.value ? parseInt(e.target.value) : undefined })}
              className="w-full p-2 bg-background border border-border rounded text-foreground"
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
            className="text-primary"
          />
          <label htmlFor="done" className="text-foreground text-sm">Mark as completed</label>
        </div>

        <div className="flex space-x-2">
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-50"
          >
            {isSubmitting ? 'Adding...' : 'Add Set'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 bg-muted text-muted-foreground rounded hover:bg-accent"
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