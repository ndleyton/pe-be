import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/shared/api/client';
import { getExercisesInWorkout, Exercise } from '../api/exercises';
import { ExerciseForm, ExerciseList } from '../features/exercises/components';
import { FinishWorkoutModal } from '../features/workouts/components';
import { SaveRecipeModal } from '../features/recipes/components/SaveRecipeModal/SaveRecipeModal';
import { FloatingActionButton } from '../shared/components/ui';
import { useGuestData, GuestExercise, GuestRecipe } from '@/contexts/GuestDataContext';
import { useWorkoutTimer } from '@/contexts/WorkoutTimerContext';

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

// Fetch a single workout by ID (for authenticated users)
const fetchWorkout = async (workoutId: string) => {
  const response = await api.get(`/workouts/${workoutId}`);
  return response.data as { id: string | number; name: string | null };
};

const WorkoutPage: React.FC = () => {
  const { workoutId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { data: guestData, actions: guestActions, isAuthenticated } = useGuestData();
  const [showFinishModal, setShowFinishModal] = useState(false);
  const [showSaveRecipeModal, setShowSaveRecipeModal] = useState(false);
  const { start, stop, startTime } = useWorkoutTimer();
  
  const recipe = location.state?.recipe as GuestRecipe | undefined;

  // Fetch workout details (only when authenticated)
  const { data: serverWorkout } = useQuery({
    queryKey: ['workout', workoutId],
    queryFn: () => fetchWorkout(workoutId as string),
    enabled: !!workoutId && isAuthenticated(),
  });

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
          id: parseInt(guestExercise.exercise_type.id) || 0,
          name: guestExercise.exercise_type.name,
          description: guestExercise.exercise_type.description,
          default_intensity_unit: guestExercise.exercise_type.default_intensity_unit,
          times_used: guestExercise.exercise_type.times_used,
          muscle_groups: [],
          equipment: null,
          created_at: guestExercise.created_at,
          updated_at: guestExercise.updated_at,
          usage_count: guestExercise.exercise_type.times_used,
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

  // Start the workout timer on mount if not already started
  useEffect(() => {
    if (!startTime) {
      // Try to derive the start time from workout data if available
      if (isAuthenticated()) {
        if (serverWorkout && (serverWorkout as any).start_time) {
          start(new Date((serverWorkout as any).start_time));
        } else {
          start();
        }
      } else {
        const guestWorkout = guestData.workouts.find(w => w.id === workoutId);
        if (guestWorkout && (guestWorkout as any).start_time) {
          start(new Date((guestWorkout as any).start_time));
        } else {
          start();
        }
      }
    }
    // We purposely ignore exhaustive-deps for start to avoid resetting interval unnecessarily
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverWorkout, workoutId]);

  // Auto-create exercises from recipe when page loads
  useEffect(() => {
    if (recipe && workoutId && exercises.length === 0) {
      if (isAuthenticated()) {
        // For authenticated users, we'd need to make API calls
        // This is simplified - would need to implement full API integration
        console.log('Would create recipe from workout for authenticated user:', recipe.name);
      } else {
        // For guest users, create exercises from the recipe
        guestActions.createExercisesFromRecipe(recipe, workoutId);
      }
    }
  }, [recipe, workoutId, exercises.length, isAuthenticated, guestActions]);

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
        finishWorkoutMutation.mutate(workoutId, {
          onSuccess: () => {
            stop();
          },
        });
      } else {
        // For guest mode, update the workout end time
        guestActions.updateWorkout(workoutId, {
          end_time: new Date().toISOString(),
        });
        stop();
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

  const handleSaveRecipe = () => {
    setShowSaveRecipeModal(true);
  };

  // Determine workout name based on authentication state
  const workoutName = isAuthenticated()
    ? serverWorkout?.name ?? null
    : guestData.workouts.find(w => w.id === workoutId)?.name ?? null;

  // Warn user on navigation/back while workout in progress
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

  return (
    <>
      <div className="max-w-2xl mx-auto p-6 bg-card text-card-foreground rounded-lg shadow-lg mt-8">
        <div className="mb-6">
          <h2 className="text-2xl font-bold">
            {workoutName ? `${workoutName}` : `Workout: #${workoutId}`}
          </h2>
        </div>
        <ExerciseForm workoutId={workoutId!} onExerciseCreated={handleExerciseCreated} />
        <ExerciseList 
          exercises={exercises} 
          isLoading={isAuthenticated() && exercisesLoading} 
          error={isAuthenticated() ? exercisesError : null} 
          workoutId={workoutId}
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
        exercises={exercises}
        onSaveRecipe={handleSaveRecipe}
        workoutName={workoutName || undefined}
      />
      
      <SaveRecipeModal
        isOpen={showSaveRecipeModal}
        onClose={() => setShowSaveRecipeModal(false)}
        workoutName={workoutName || 'My Recipe'}
        exercises={exercises}
      />
    </>
  );
};

export default WorkoutPage;
