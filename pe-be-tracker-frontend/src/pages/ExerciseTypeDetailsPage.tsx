import React from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { HiOutlineArrowLeft, HiOutlinePhoto } from 'react-icons/hi2';
import { getExerciseTypeById, getExerciseTypeStats } from '@/api/exercises';
import { ProgressiveOverloadChart } from '@/features/exercises/components';
import { LastWorkoutInfo, PersonalBestInfo } from '@/features/exercises/components';
import { addExerciseToCurrentWorkout } from '@/api/workouts';

const ExerciseTypeDetailsPage: React.FC = () => {
  const { exerciseTypeId } = useParams<{ exerciseTypeId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: exerciseType, isLoading: isLoadingExerciseType, error: exerciseTypeError } = useQuery({
    queryKey: ['exerciseType', exerciseTypeId],
    queryFn: () => getExerciseTypeById(exerciseTypeId!),
    enabled: !!exerciseTypeId,
  });

  const { data: stats, isLoading: isLoadingStats, error: statsError } = useQuery({
    queryKey: ['exerciseTypeStats', exerciseTypeId],
    queryFn: () => getExerciseTypeStats(exerciseTypeId!),
    enabled: !!exerciseTypeId && !!exerciseType,
    retry: 1,
  });

  const addMutation = useMutation({
    mutationFn: () =>
      addExerciseToCurrentWorkout({
        exercise_type_id: Number(exerciseTypeId),
      }),
    onSuccess: (workout) => {
      // Invalidate queries to avoid cache issues on redirect
      queryClient.invalidateQueries({ queryKey: ['workout', workout.id.toString()] });
      queryClient.invalidateQueries({ queryKey: ['exercises', workout.id.toString()] });
      navigate(`/workout/${workout.id}`);
    },
    onError: (error) => {
      alert(`An error occurred: ${error.message}`);
    }
  });

  if (exerciseTypeError) {
    return (
      <div className="container mx-auto px-4 py-6">
        <div className="alert alert-error">
          <span>Error loading exercise type. Please try again.</span>
        </div>
      </div>
    );
  }

  if (isLoadingExerciseType) {
    return (
      <div className="container mx-auto px-4 py-6">
        <div className="flex justify-center py-8">
          <span className="loading loading-spinner loading-lg"></span>
        </div>
      </div>
    );
  }

  if (!exerciseType) {
    return (
      <div className="container mx-auto px-4 py-6">
        <div className="alert alert-warning">
          <span>Exercise type not found.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link to="/exercise-types" className="btn btn-ghost btn-circle">
          <HiOutlineArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-3xl font-bold">{exerciseType.name}</h1>
        <button
          className="btn btn-primary btn-sm ml-auto"
          onClick={() => addMutation.mutate()}
          disabled={addMutation.isPending}
        >
          {addMutation.isPending ? 'Adding...' : 'Add to Current Workout'}
        </button>
      </div>

      {statsError && (
        <div className="alert alert-error mb-6">
          <span>Error loading exercise statistics. Please try again later.</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-6">
          {/* Exercise Image Placeholder */}
          <div className="card bg-base-100 shadow-md">
            <div className="card-body">
              <div className="aspect-video bg-gray-100 rounded-lg flex items-center justify-center">
                <div className="text-center text-gray-500">
                  <HiOutlinePhoto className="h-16 w-16 mx-auto mb-2" />
                  <p>Exercise image coming soon</p>
                </div>
              </div>
            </div>
          </div>

          <div className="card bg-base-100 shadow-md">
            <div className="card-body">
              <h2 className="card-title">Description</h2>
              <p className="text-gray-700">
                {exerciseType.description || 'No description available for this exercise type.'}
              </p>
            </div>
          </div>

          {exerciseType.muscles && exerciseType.muscles.length > 0 && (
            <div className="card bg-base-100 shadow-md">
              <div className="card-body">
                <h2 className="card-title">Target Muscles</h2>
                <div className="flex flex-wrap gap-2">
                  {exerciseType.muscles.map((muscle) => (
                    <span key={muscle.id} className="badge badge-primary">
                      {muscle.name}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="card bg-base-100 shadow-md">
            <div className="card-body">
              <h2 className="card-title">Progressive Overload</h2>
              {isLoadingStats ? (
                <div className="flex justify-center py-8">
                  <span className="loading loading-spinner loading-md"></span>
                </div>
              ) : stats?.progressiveOverload && stats.progressiveOverload.length > 0 ? (
                <ProgressiveOverloadChart data={stats.progressiveOverload} />
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <p>No workout data available yet.</p>
                  <p className="text-sm">Start tracking workouts to see your progress!</p>
                </div>
              )}
            </div>
          </div>
          <div className="card bg-base-100 shadow-md">
            <div className="card-body">
              <h2 className="card-title">Last Workout</h2>
              {isLoadingStats ? (
                <div className="flex justify-center py-4">
                  <span className="loading loading-spinner loading-sm"></span>
                </div>
              ) : stats?.lastWorkout ? (
                <LastWorkoutInfo 
                  lastWorkout={stats.lastWorkout}
                  intensityUnit={stats.intensityUnit}
                />
              ) : (
                <p className="text-gray-500">You haven't done this exercise yet.</p>
              )}
            </div>
          </div>
          <div className="card bg-base-100 shadow-md">
            <div className="card-body">
              <h2 className="card-title">Personal Best</h2>
              {isLoadingStats ? (
                <div className="flex justify-center py-4">
                  <span className="loading loading-spinner loading-sm"></span>
                </div>
              ) : stats?.personalBest ? (
                <PersonalBestInfo 
                  personalBest={stats.personalBest}
                  intensityUnit={stats.intensityUnit}
                />
              ) : (
                <p className="text-gray-500">No personal best recorded yet.</p>
              )}
            </div>
          </div>
          <div className="card bg-base-100 shadow-md">
            <div className="card-body">
              <h2 className="card-title">Usage Statistics</h2>
              <div className="stats stats-vertical lg:stats-horizontal w-full">
                <div className="stat">
                  <div className="stat-title">Times Used</div>
                  <div className="stat-value text-primary">{exerciseType.times_used}</div>
                </div>
                {stats?.totalSets && (
                  <div className="stat">
                    <div className="stat-title">Total Sets</div>
                    <div className="stat-value text-secondary">{stats.totalSets}</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExerciseTypeDetailsPage;