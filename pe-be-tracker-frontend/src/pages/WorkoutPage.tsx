import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../api/client';
import { getExercisesInWorkout } from '../api/exercises';
import ExerciseForm from '../components/ExerciseForm';
import ExerciseList from '../components/ExerciseList';
import FinishWorkoutModal from '../components/FinishWorkoutModal';
import FloatingActionButton from '../components/FloatingActionButton';

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
  const [showFinishModal, setShowFinishModal] = useState(false);

  // Fetch exercises for this workout
  const { data: exercises = [], isLoading: exercisesLoading, error: exercisesError } = useQuery({
    queryKey: ['exercises', workoutId],
    queryFn: () => getExercisesInWorkout(workoutId as string),
    enabled: !!workoutId,
  });

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

  // Invalidate exercises query when a new exercise is created
  const handleExerciseCreated = () => {
    queryClient.invalidateQueries({ queryKey: ['exercises', workoutId] });
  };

  const handleFinishWorkout = () => {
    console.log('handleFinishWorkout called with workoutId:', workoutId);
    if (workoutId) {
      finishWorkoutMutation.mutate(workoutId);
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
          isLoading={exercisesLoading} 
          error={exercisesError} 
        />
      </div>
      
      <FloatingActionButton
        onClick={() => setShowFinishModal(true)}
        disabled={finishWorkoutMutation.isPending}
      >
        <span className="text-lg">✓</span>
      </FloatingActionButton>
      
      <FinishWorkoutModal
        isOpen={showFinishModal}
        onConfirm={handleFinishWorkout}
        onCancel={handleCancelFinish}
        isLoading={finishWorkoutMutation.isPending}
      />
    </>
  );
};

export default WorkoutPage;
