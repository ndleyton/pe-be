import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/shared/api/client';
import { getExercisesInWorkout, Exercise } from '@/features/exercises/api';
import { ExerciseForm, ExerciseList } from '@/features/exercises/components';
import { FinishWorkoutModal } from '@/features/workouts/components';
import { Button } from '@/shared/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { SaveRoutineModal } from '@/features/routines/components/SaveRoutineModal/SaveRoutineModal';
import FloatingActionButton from '@/shared/components/FloatingActionButton';
import { useGuestStore, useAuthStore, useUIStore, GuestExercise, GuestRecipe } from '@/stores';
import { getCurrentUTCTimestamp } from '@/utils/date';

const updateWorkoutEndTime = async (workoutId: string) => {
  const response = await api.patch(
    `/workouts/${workoutId}`,
    {
      end_time: getCurrentUTCTimestamp(),
    },
  );
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
  
  // Get state from stores
  const isAuthenticated = useAuthStore(state => state.isAuthenticated);
  const authLoading = useAuthStore(state => state.loading);
  const guestData = useGuestStore();
  const guestActions = useGuestStore();
  
  // Get workout timer state and actions from UI store
  const startTime = useUIStore(state => state.workoutTimer.startTime);
  const startWorkoutTimer = useUIStore(state => state.startWorkoutTimer);
  const stopWorkoutTimer = useUIStore(state => state.stopWorkoutTimer);
  
  const [showFinishModal, setShowFinishModal] = useState(false);
  const [showSaveRecipeModal, setShowSaveRecipeModal] = useState(false);
  
  const recipe = location.state?.recipe as GuestRecipe | undefined;

  // Fetch workout details (only when authenticated)
  const { data: serverWorkout } = useQuery({
    queryKey: ['workout', workoutId],
    queryFn: () => fetchWorkout(workoutId as string),
    enabled: !!workoutId && isAuthenticated,
  });

  // Fetch exercises for this workout (only when authenticated)
  const { data: serverExercises, isLoading: exercisesLoading, error: exercisesError } = useQuery({
    queryKey: ['exercises', workoutId],
    queryFn: () => getExercisesInWorkout(workoutId as string),
    enabled: !!workoutId && isAuthenticated, // Only fetch when authenticated
  });

  // Use guest data if not authenticated, server data if authenticated
  const exercises: Exercise[] = React.useMemo(() => {
    if (isAuthenticated) {
      return Array.isArray(serverExercises) ? serverExercises : [];
    } else {
      const guestWorkout = guestData.workouts.find(w => w.id === workoutId);
      const guestExercises = guestWorkout?.exercises || [];
      return Array.isArray(guestExercises) ? guestExercises.map((guestExercise: GuestExercise): Exercise => ({
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
          equipment: guestExercise.exercise_type.equipment || null,
          instructions: guestExercise.exercise_type.instructions || null,
          category: guestExercise.exercise_type.category || null,
          created_at: guestExercise.exercise_type.created_at || guestExercise.created_at,
          updated_at: guestExercise.exercise_type.updated_at || guestExercise.updated_at,
          usage_count: guestExercise.exercise_type.usage_count || guestExercise.exercise_type.times_used,
          // Ensure muscles and muscle_groups are passed through
          muscles: guestExercise.exercise_type.muscles || [],
          muscle_groups: guestExercise.exercise_type.muscle_groups || [],
        },
        exercise_sets: Array.isArray(guestExercise.exercise_sets) ? guestExercise.exercise_sets.map(guestSet => ({
          id: guestSet.id,
          reps: guestSet.reps,
          intensity: guestSet.intensity,
          intensity_unit_id: guestSet.intensity_unit_id,
          exercise_id: guestSet.exercise_id,
          rest_time_seconds: guestSet.rest_time_seconds,
          done: guestSet.done,
          created_at: guestSet.created_at,
          updated_at: guestSet.updated_at,
        })) : [],
      })) : [];
    }
  }, [isAuthenticated, serverExercises, guestData.workouts, workoutId]);

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
      if (isAuthenticated) {
        if (serverWorkout && (serverWorkout as any).start_time) {
          const workoutStartTime = (serverWorkout as any).start_time;
          try {
            const startDate = new Date(workoutStartTime);
            // Validate the date and ensure it's not in the future
            if (!isNaN(startDate.getTime()) && startDate.getTime() <= Date.now()) {
              startWorkoutTimer(startDate);
            } else {
              console.warn('Invalid or future workout start time, using current time:', workoutStartTime);
              startWorkoutTimer();
            }
          } catch (error) {
            console.warn('Failed to parse workout start time, using current time:', workoutStartTime, error);
            startWorkoutTimer();
          }
        } else {
          startWorkoutTimer();
        }
      } else {
        const guestWorkout = guestData.workouts.find(w => w.id === workoutId);
        if (guestWorkout && (guestWorkout as any).start_time) {
          const workoutStartTime = (guestWorkout as any).start_time;
          try {
            const startDate = new Date(workoutStartTime);
            // Validate the date and ensure it's not in the future
            if (!isNaN(startDate.getTime()) && startDate.getTime() <= Date.now()) {
              startWorkoutTimer(startDate);
            } else {
              console.warn('Invalid or future workout start time, using current time:', workoutStartTime);
              startWorkoutTimer();
            }
          } catch (error) {
            console.warn('Failed to parse workout start time, using current time:', workoutStartTime, error);
            startWorkoutTimer();
          }
        } else {
          startWorkoutTimer();
        }
      }
    }
    // We purposely ignore exhaustive-deps for startWorkoutTimer to avoid resetting interval unnecessarily
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverWorkout, workoutId]);

  // Auto-create exercises from recipe when page loads
  useEffect(() => {
    if (recipe && workoutId && exercises?.length === 0) {
      if (isAuthenticated) {
        // For authenticated users, we'd need to make API calls
        // This is simplified - would need to implement full API integration
      } else {
        // For guest users, create exercises from the routine
        guestActions.createExercisesFromRoutine(recipe, workoutId);
      }
    }
  }, [recipe, workoutId, exercises?.length, isAuthenticated, guestActions]);

  // Invalidate exercises query when a new exercise is created (only for authenticated users)
  const handleExerciseCreated = () => {
    if (isAuthenticated) {
      queryClient.invalidateQueries({ queryKey: ['exercises', workoutId] });
    }
    // For guest mode, the data is already updated via the context
  };

  // Handle exercise updates (sets added/modified)
  const handleExerciseUpdate = (updatedExercise: Exercise, shouldInvalidateQuery: boolean = false) => {
    if (isAuthenticated && shouldInvalidateQuery) {
      // Only invalidate query when necessary (e.g., for structural changes, not notes)
      queryClient.invalidateQueries({ queryKey: ['exercises', workoutId] });
    } else if (isAuthenticated) {
      // For optimistic updates (like notes), just update the query data directly
      queryClient.setQueryData(['exercises', workoutId], (oldData: Exercise[] | undefined) => {
        if (!oldData) return oldData;
        return oldData.map(exercise => 
          exercise.id === updatedExercise.id ? updatedExercise : exercise
        );
      });
    } else {
      // For guest mode, update the local exercise data
      // Convert ExerciseSet[] to GuestExerciseSet[] by ensuring all IDs are strings
      const guestExerciseSets = updatedExercise.exercise_sets.map(set => ({
        ...set,
        id: String(set.id),
        exercise_id: String(set.exercise_id)
      }));
      
      guestActions.updateExercise(String(updatedExercise.id), {
        exercise_sets: guestExerciseSets
      });
    }
  };

  const handleFinishWorkout = () => {
    if (workoutId) {
      if (isAuthenticated) {
        finishWorkoutMutation.mutate(workoutId, {
          onSuccess: () => {
            stopWorkoutTimer();
          },
        });
      } else {
        // For guest mode, update the workout end time
        guestActions.updateWorkout(workoutId, {
          end_time: getCurrentUTCTimestamp(),
        });
        stopWorkoutTimer();
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
  const workoutName = isAuthenticated
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

  // Determine list status to control skeleton/empty/error states
  const guestHydrated = (useGuestStore as any)?.persist?.hasHydrated?.() ?? true;
  const guestHydrating = !isAuthenticated && !guestHydrated;
  const listStatus: 'pending' | 'success' | 'error' =
    (authLoading || guestHydrating || (isAuthenticated && exercisesLoading))
      ? 'pending'
      : (isAuthenticated && exercisesError ? 'error' : 'success');

  return (
    <div className="max-w-5xl mx-auto p-2 md:p-4 lg:p-8 text-center">
      <div className="max-w-2xl mx-auto p-2 md:p-4 lg:p-6 bg-card text-card-foreground rounded-lg shadow-lg mt-2 md:mt-4 lg:mt-8">
        <div className="flex items-center gap-4 mb-3 sm:mb-4 md:mb-6 text-left">
          <Button variant="ghost" size="icon" asChild aria-label="Go back" className="lg:hidden">
            <Link to="/workouts">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <h2 className="text-2xl font-bold">
            {workoutName ? `${workoutName}` : `Workout: #${workoutId}`}
          </h2>
        </div>
        <ExerciseList 
          exercises={exercises}
          status={listStatus}
          workoutId={workoutId}
          onExerciseUpdate={handleExerciseUpdate}
        />
        <div className="h-px w-full bg-primary mb-4 mt-4" role="separator" />
         <ExerciseForm workoutId={workoutId!} onExerciseCreated={handleExerciseCreated} />
      </div>
      
      <FloatingActionButton
        onClick={() => setShowFinishModal(true)}
        disabled={isAuthenticated && finishWorkoutMutation.isPending}
      >
        <span className="text-lg">✓</span>
      </FloatingActionButton>
      
      <FinishWorkoutModal
        isOpen={showFinishModal}
        onConfirm={handleFinishWorkout}
        onCancel={handleCancelFinish}
        isLoading={isAuthenticated && finishWorkoutMutation.isPending}
        exercises={exercises}
        onSaveRecipe={handleSaveRecipe}
        workoutName={workoutName || undefined}
      />
      
      <SaveRoutineModal
        isOpen={showSaveRecipeModal}
        onClose={() => setShowSaveRecipeModal(false)}
        workoutName={workoutName || 'My Recipe'}
        exercises={exercises}
        workoutId={workoutId}
      />
    </div>
  );
};

export default WorkoutPage;
