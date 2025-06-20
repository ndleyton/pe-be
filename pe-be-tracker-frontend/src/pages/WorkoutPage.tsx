import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/shared/api/client';
import { getExercisesInWorkout, Exercise } from '../api/exercises';
import { ExerciseForm, ExerciseList } from '../features/exercises/components';
import { FinishWorkoutModal } from '../features/workouts/components';
import { FloatingActionButton } from '../shared/components/ui';
import { useGuestData, GuestExercise } from '../contexts/GuestDataContext';

const updateWorkoutEndTime = async (workoutId: string) => {
  console.log('Updating workout end time for ID:', workoutId);
  const response = await api.patch(
    `/workouts/${workoutId}`,
    {
      end_time: new Date().toISOString(),
    },
  );
  console.log('Workout updated successfully:', response.data);
  return response.data;
};

const WorkoutPage: React.FC = () => {
  const { workoutId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: guestData, actions: guestActions, isAuthenticated } = useGuestData();
  const [showFinishModal, setShowFinishModal] = useState(false);

  // Fetch exercises for this workout (only when authenticated)
  const { data: serverExercises = [], isLoading: exercisesLoading, error: exercisesError } = useQuery({
    queryKey: ['exercises', workoutId],
    queryFn: () => getExercisesInWorkout(workoutId as string),
    enabled: !!workoutId && isAuthenticated(), // Only fetch when authenticated
  });

  // Use guest data if not authenticated, server data if authenticated
  const exercises: Exercise[] = isAuthenticated() 
    ? serverExercises 
    : (guestData.workouts.find(w => w.id === workoutId)?.exercises || []).map((guestExercise: GuestExercise): Exercise => ({
        id: guestExercise.id,
        timestamp: guestExercise.timestamp,
        notes: guestExercise.notes,
        exercise_type_id: guestExercise.exercise_type_id,
        workout_id: guestExercise.workout_id,
        created_at: guestExercise.created_at,
        updated_at: guestExercise.updated_at,
        exercise_type: {
          id: guestExercise.exercise_type.id,
          name: guestExercise.exercise_type.name,
          description: guestExercise.exercise_type.description,
          default_intensity_unit: guestExercise.exercise_type.default_intensity_unit,
          times_used: guestExercise.exercise_type.times_used,
        },
        exercise_sets: guestExercise.exercise_sets.map(guestSet => ({
          id: guestSet.id,
          reps: guestSet.reps,
          intensity: guestSet.intensity,
          intensity_unit_id: guestSet.intensity_unit_id,
          exercise_id: guestSet.exercise_id,
          rest_time_seconds: guestSet.rest_time_seconds,
          done: guestSet.done,
          created_at: guestSet.created_at,
          updated_at: guestSet.updated_at,
        })),
      }));

  const finishWorkoutMutation = useMutation({
    mutationFn: (id: string) => updateWorkoutEndTime(id),
    onSuccess: () => {
      setShowFinishModal(false);
      navigate('/workouts');
    },
    onError: (error) => {
      console.error('Failed to finish workout:', error);
      setShowFinishModal(false);
    },
  });

  // Handle page exit/navigation
  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };

    const handlePopState = () => {
      setShowFinishModal(true);
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  // Invalidate exercises query when a new exercise is created (only for authenticated users)
  const handleExerciseCreated = () => {
    if (isAuthenticated()) {
      queryClient.invalidateQueries({ queryKey: ['exercises', workoutId] });
    }
    // For guest mode, the data is already updated via the context
  };

  const handleFinishWorkout = () => {
    console.log('handleFinishWorkout called with workoutId:', workoutId);
    if (workoutId) {
      if (isAuthenticated()) {
        finishWorkoutMutation.mutate(workoutId);
      } else {
        // For guest mode, update the workout end time
        guestActions.updateWorkout(workoutId, {
          end_time: new Date().toISOString(),
        });
        setShowFinishModal(false);
        navigate('/workouts');
      }
    } else {
      console.error('No workoutId available');
    }
  };

  const handleCancelFinish = () => {
    setShowFinishModal(false);
    // Push the current state back to prevent navigation
    window.history.pushState(null, '', window.location.pathname);
  };

  return (
    <>
      <div className="max-w-2xl mx-auto p-6 bg-gray-900 text-gray-100 rounded-lg shadow-lg mt-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Log Exercises for Workout #{workoutId}</h1>
        </div>
        <ExerciseForm workoutId={workoutId!} onExerciseCreated={handleExerciseCreated} />
        <ExerciseList 
          exercises={exercises} 
          isLoading={isAuthenticated() && exercisesLoading} 
          error={isAuthenticated() ? exercisesError : null} 
        />
      </div>
      
      <FloatingActionButton
        onClick={() => setShowFinishModal(true)}
        disabled={isAuthenticated() && finishWorkoutMutation.isPending}
      >
        <span className="text-lg">✓</span>
      </FloatingActionButton>
      
      <FinishWorkoutModal
        isOpen={showFinishModal}
        onConfirm={handleFinishWorkout}
        onCancel={handleCancelFinish}
        isLoading={isAuthenticated() && finishWorkoutMutation.isPending}
      />
    </>
  );
};

export default WorkoutPage;
