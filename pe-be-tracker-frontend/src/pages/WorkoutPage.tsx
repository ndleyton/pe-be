import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import api from '../api/client';
import ExerciseForm from '../components/ExerciseForm';
import FinishWorkoutModal from '../components/FinishWorkoutModal';

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
  const [showFinishModal, setShowFinishModal] = useState(false);

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

  // Placeholder: implement exercise list and refresh logic in the future
  const handleExerciseCreated = () => {
    // TODO: Fetch and display exercises for this workout
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
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Log Exercises for Workout #{workoutId}</h1>
          <button
            onClick={() => setShowFinishModal(true)}
            className="bg-green-600 hover:bg-green-700 text-white font-semibold rounded px-4 py-2 transition-colors duration-200"
          >
            Finish Workout
          </button>
        </div>
        <ExerciseForm workoutId={workoutId!} onExerciseCreated={handleExerciseCreated} />
        {/* TODO: Render list of exercises and ExerciseSet logging UI here */}
        <p>This is where you can add exercises and sets for this workout.</p>
      </div>
      
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
