import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation } from '@tanstack/react-query';
import api from '@/shared/api/client';
import { toUTCISOString } from '@/utils/date';
import ExerciseTypeModal from '../ExerciseTypeModal';
import { ExerciseType } from '@/api/exercises';
import { useGuestData, GuestExerciseType } from '@/contexts/GuestDataContext';
import { Button } from '@/components/ui/button';

interface ExerciseFormData {
  exercise_type_id: number | string; // Can be number (server) or string (guest)
  timestamp?: string;
  notes?: string;
}

interface ExerciseFormProps {
  workoutId: string;
  onExerciseCreated: () => void;
}

const createExercise = async (data: ExerciseFormData & { workout_id: number }) => {
  const response = await api.post(
    '/exercises/',
    {
      exercise_type_id: data.exercise_type_id,
      workout_id: data.workout_id,
      timestamp: data.timestamp ? toUTCISOString(data.timestamp) : null,
      notes: data.notes || null,
    },
  );
  return response.data;
};

const ExerciseForm: React.FC<ExerciseFormProps> = ({ workoutId, onExerciseCreated }) => {
  const { data: guestData, actions: guestActions, isAuthenticated } = useGuestData();
  const [showModal, setShowModal] = useState(false);
  const [selectedExerciseType, setSelectedExerciseType] = useState<ExerciseType | GuestExerciseType | null>(null);
  
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    clearErrors,
    formState: { errors },
  } = useForm<ExerciseFormData>();

  const mutation = useMutation({
    mutationFn: (data: ExerciseFormData) => createExercise({ ...data, workout_id: Number(workoutId) }),
    onSuccess: () => {
      reset();
      setSelectedExerciseType(null);
      onExerciseCreated();
    },
  });

  const onSubmit = (data: ExerciseFormData) => {
    if (isAuthenticated()) {
      // Use API for authenticated users
      mutation.mutate({
        ...data,
        timestamp: new Date().toISOString(),
      });
    } else {
      // Use guest context for unauthenticated users
      const exerciseType = guestData.exerciseTypes.find(et => et.id === data.exercise_type_id);
      if (!exerciseType) {
        console.error('Exercise type not found:', data.exercise_type_id);
        return;
      }

      guestActions.addExercise({
        exercise_type_id: data.exercise_type_id as string,
        workout_id: workoutId,
        timestamp: new Date().toISOString(),
        notes: data.notes || null,
        exercise_type: exerciseType,
      });

      reset();
      setSelectedExerciseType(null);
      onExerciseCreated();
    }
  };

  const handleExerciseTypeSelect = (exerciseType: ExerciseType | GuestExerciseType) => {
    setSelectedExerciseType(exerciseType);
    setValue('exercise_type_id', exerciseType.id, { shouldValidate: true });
    clearErrors('exercise_type_id');
    setShowModal(false);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="mb-6 border border-border p-4 rounded-lg bg-card text-card-foreground shadow w-full max-w-lg mx-auto">
      <h2 className="text-lg font-semibold mb-4">Add Exercise</h2>
      <div className="mb-4">
        {selectedExerciseType ? (
          <div
            onClick={() => setShowModal(true)}
            className="bg-background rounded-lg p-4 border border-border cursor-pointer hover:bg-accent transition-colors"
          >
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
                <span className="text-primary-foreground font-bold">
                  {selectedExerciseType.name.charAt(0)}
                </span>
              </div>
              <div className="flex-1">
                <h4 className="text-foreground font-medium">{selectedExerciseType.name}</h4>
                <p className="text-muted-foreground text-sm mt-1">{selectedExerciseType.description}</p>
              </div>
              <div className="text-muted-foreground">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </div>
            </div>
          </div>
        ) : (
          <Button
            type="button"
            onClick={() => setShowModal(true)}
            variant="outline"
            className="w-full bg-background text-foreground border-border hover:bg-accent justify-start"
          >
            Select Exercise
          </Button>
        )}
        <input
          type="hidden"
          {...register('exercise_type_id', {
            required: 'Exercise is required',
            valueAsNumber: isAuthenticated(), // Only convert to number if authenticated
          })}
        />
        {errors.exercise_type_id && <div className="text-destructive text-sm mt-2">{errors.exercise_type_id.message}</div>}
      </div>
      <div className="mb-4">
        <label className="block mb-1 text-foreground font-medium">Notes:
          <input
            type="text"
            {...register('notes')}
            className="mt-1 mb-2 w-full bg-background text-foreground border border-border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </label>
      </div>
      <Button
        type="submit"
        disabled={isAuthenticated() && mutation.isPending}
        className="bg-primary hover:bg-primary/90 px-6 py-2 mt-2"
      >
        {(isAuthenticated() && mutation.isPending) ? 'Adding...' : 'Add Exercise'}
      </Button>
      {isAuthenticated() && mutation.error && <div className="text-destructive mt-3">Failed to create exercise.</div>}

      <ExerciseTypeModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSelect={handleExerciseTypeSelect}
      />
    </form>
  );
};

export default ExerciseForm;
