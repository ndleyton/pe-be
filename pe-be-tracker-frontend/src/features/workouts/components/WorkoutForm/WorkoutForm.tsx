import React, { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import api from '@/shared/api/client';
import { toUTCISOString } from '@/utils/date';
import WorkoutTypeModal, { WorkoutType } from '../WorkoutTypeModal';
import { useGuestData, GuestWorkoutType } from '@/contexts/GuestDataContext';
import { Button } from '@/components/ui/button';

interface WorkoutFormData {
  name?: string;
  notes?: string;
  start_time: string;
  end_time?: string;
  workout_type_id: number | string; // Can be number (server) or string (guest)
}

interface WorkoutFormProps {
  onWorkoutCreated: (newWorkoutId: number | string) => void; // Can be number (server) or string (guest)
}

const createWorkout = async (data: WorkoutFormData) => {
  const response = await api.post(
    '/workouts/',
    {
      name: data.name || null,
      notes: data.notes || null,
      start_time: data.start_time ? toUTCISOString(data.start_time) : null,
      end_time: data.end_time ? toUTCISOString(data.end_time) : null,
      workout_type_id: data.workout_type_id,
    },
  );
  return response.data;
};

const WorkoutForm: React.FC<WorkoutFormProps> = ({ onWorkoutCreated }) => {
  const navigate = useNavigate();
  const { data: guestData, actions: guestActions, isAuthenticated } = useGuestData();
  const [showModal, setShowModal] = useState(false);
  const [selectedWorkoutType, setSelectedWorkoutType] = useState<WorkoutType | GuestWorkoutType | null>(null);
  const [isEditingName, setIsEditingName] = useState(false);
  
  const {
    register,
    handleSubmit,
    reset,
    formState,
    setValue,
    watch,
  } = useForm<WorkoutFormData>({
    defaultValues: {
      name: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      start_time: new Date().toISOString().slice(0, 16),
    },
  });

  const nameField = watch('name');
  const datePrefix = useMemo(() => new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), []);

  useEffect(() => {
    if (selectedWorkoutType && (!formState.dirtyFields.name || nameField === datePrefix)) {
      setValue('name', `${selectedWorkoutType.name} - ${datePrefix}`);
    }
  }, [selectedWorkoutType, datePrefix, formState.dirtyFields.name, nameField, setValue]);

  const mutation = useMutation({
    mutationFn: createWorkout,
    onSuccess: (data) => {
      const newWorkoutId = data.id;
      resetForm();
      onWorkoutCreated(newWorkoutId);
      navigate(`/workout/${newWorkoutId}`);
    },
  });

  const onSubmit = (data: WorkoutFormData) => {
    if (isAuthenticated()) {
      // Use API for authenticated users
      mutation.mutate(data);
    } else {
      // Use guest context for unauthenticated users
      const workoutType = guestData.workoutTypes.find(wt => wt.id === data.workout_type_id);
      if (!workoutType) {
        console.error('Workout type not found:', data.workout_type_id);
        return;
      }

      const newWorkoutId = guestActions.addWorkout({
        name: data.name || null,
        notes: data.notes || null,
        start_time: data.start_time || new Date().toISOString(),
        end_time: data.end_time || null,
        workout_type_id: data.workout_type_id as string,
        workout_type: workoutType,
      });

      resetForm();
      onWorkoutCreated(newWorkoutId);
      navigate(`/workout/${newWorkoutId}`);
    }
  };

  const handleWorkoutTypeSelect = (workoutType: WorkoutType | GuestWorkoutType) => {
    setSelectedWorkoutType(workoutType);
    setValue('workout_type_id', workoutType.id);
    setShowModal(false);
  };

  const resetForm = () => {
    reset();
    setSelectedWorkoutType(null);
    setIsEditingName(false);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="mb-6 border border-border p-6 rounded-lg bg-card text-card-foreground shadow-lg w-full max-w-md mx-auto">
      <div className="mb-6">
        {isEditingName ? (
          <div className="flex items-center space-x-2">
            <input
              type="text"
              {...register('name')}
              data-testid="workout-name-input"
              className="flex-1 bg-background text-foreground border border-border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring"
              autoFocus
            />
            <Button
              type="button"
              onClick={() => setIsEditingName(false)}
              aria-label="save workout name"
              size="icon"
              className="bg-primary hover:bg-primary/90"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </Button>
          </div>
        ) : (
          <div
            onClick={() => setIsEditingName(true)}
            className="flex items-center justify-between cursor-pointer group"
          >
            <h2 className="text-xl font-semibold text-foreground">{nameField || 'Workout Name'}</h2>
            <svg className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          </div>
        )}
      </div>
      <div className="mb-4">
        <label className="block mb-1 text-foreground font-medium">Notes:
          <input
            placeholder="How am I feeling today?"
            type="text"
            {...register('notes')}
            data-testid="workout-notes-input"
            className="mt-1 mb-2 w-full bg-background text-foreground border border-border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </label>
      </div>
      <div className="mb-4">
        <label className="block mb-1 text-foreground font-medium">Start Time:
          <input
            type="datetime-local"
            {...register('start_time', { required: 'Start time is required' })}
            className="mt-1 mb-2 w-full bg-background text-foreground border border-border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </label>
        {formState.errors.start_time && <div className="text-destructive text-sm">{formState.errors.start_time.message}</div>}
      </div>
      <div className="mb-4">
        {selectedWorkoutType ? (
          <div
            onClick={() => setShowModal(true)}
            className="bg-background rounded-lg p-4 border border-border cursor-pointer hover:bg-accent transition-colors"
          >
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
                <span className="text-primary-foreground font-bold">
                  {selectedWorkoutType.name.charAt(0)}
                </span>
              </div>
              <div className="flex-1">
                <h4 className="text-foreground font-medium">{selectedWorkoutType.name}</h4>
                <p className="text-muted-foreground text-sm mt-1">{selectedWorkoutType.description}</p>
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
            data-testid="open-workout-type-modal"
          >
            Select Workout Type
          </Button>
        )}
        <input
          type="hidden"
          {...register('workout_type_id', {
            required: 'Workout type is required',
            valueAsNumber: isAuthenticated(), // Only convert to number if authenticated
          })}
        />
        {formState.errors.workout_type_id && <div className="text-destructive text-sm mt-2">{formState.errors.workout_type_id.message}</div>}
      </div>
      <Button
        type="submit"
        disabled={isAuthenticated() && mutation.isPending}
        className="bg-primary hover:bg-primary/90 px-6 py-2 mt-2"
        data-testid="start-workout-button"
      >
        {(isAuthenticated() && mutation.isPending) ? 'Creating...' : 'Start Workout'}
      </Button>
      {isAuthenticated() && mutation.error && <div className="text-destructive mt-3">Failed to create workout.</div>}

      <WorkoutTypeModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSelect={handleWorkoutTypeSelect}
      />
    </form>
  );
};

export default WorkoutForm;
