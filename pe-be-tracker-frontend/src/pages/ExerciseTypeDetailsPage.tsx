import React, { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Image } from 'lucide-react';
import { getExerciseTypeById, getExerciseTypeStats } from '@/api/exercises';
import { ProgressiveOverloadChart } from '@/features/exercises/components';
import { LastWorkoutInfo, PersonalBestInfo } from '@/features/exercises/components';
import { addExerciseToCurrentWorkout } from '@/features/workouts';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel';

const ExerciseTypeDetailsPage: React.FC = () => {
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());
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
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            Error loading exercise type. Please try again.
          </AlertDescription>
        </Alert>
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
        <Alert variant="warning">
          <AlertTitle>Not Found</AlertTitle>
          <AlertDescription>
            Exercise type not found.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/exercise-types">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <h1 className="text-3xl font-bold">{exerciseType.name}</h1>
        <Button
          size="sm"
          className="ml-auto"
          onClick={() => addMutation.mutate()}
          disabled={addMutation.isPending}
        >
          {addMutation.isPending ? 'Adding...' : 'Add to Current Workout'}
        </Button>
      </div>

      {statsError && (
        <Alert variant="destructive" className="mb-6">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            Error loading exercise statistics. Please try again later.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-6">
          {/* Exercise Images */}
          <Card className="shadow-md">
            <CardContent className="pt-6">
              <div className="aspect-video bg-muted rounded-lg flex items-center justify-center overflow-hidden">
                {(() => {
                  // Filter out failed images
                  const validImages = exerciseType.images?.filter(img => !failedImages.has(img)) || [];
                  
                  if (validImages.length > 0) {
                    return (
                      <Carousel className="w-full h-full">
                        <CarouselContent>
                          {validImages.map((imageUrl, index) => (
                            <CarouselItem key={imageUrl}>
                              <img 
                                src={imageUrl} 
                                alt={`${exerciseType.name} - Image ${index + 1}`}
                                className="w-full h-full object-cover rounded-lg"
                                onError={() => {
                                  setFailedImages(prev => new Set(prev).add(imageUrl));
                                }}
                              />
                            </CarouselItem>
                          ))}
                        </CarouselContent>
                        {validImages.length > 1 && (
                          <>
                            <CarouselPrevious className="left-2" />
                            <CarouselNext className="right-2" />
                          </>
                        )}
                      </Carousel>
                    );
                  } else {
                    return (
                      <div className="text-center text-muted-foreground flex flex-col items-center justify-center">
                        <Image className="h-16 w-16 mx-auto mb-2" />
                        <p>Exercise image coming soon</p>
                      </div>
                    );
                  }
                })()}
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-md">
            <CardHeader>
              <CardTitle>Description</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                {exerciseType.description || 'No description available for this exercise type.'}
              </p>
            </CardContent>
          </Card>

          {exerciseType.muscles && exerciseType.muscles.length > 0 && (
            <Card className="shadow-md">
              <CardHeader>
                <CardTitle>Target Muscles</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {exerciseType.muscles.map((muscle) => (
                    <span key={muscle.id} className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-primary text-primary-foreground hover:bg-primary/80">
                      {muscle.name}
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card className="shadow-md">
            <CardHeader>
              <CardTitle>Progressive Overload</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingStats ? (
                <div className="flex justify-center py-8">
                  <span className="loading loading-spinner loading-md"></span>
                </div>
              ) : stats?.progressiveOverload && stats.progressiveOverload.length > 0 ? (
                <ProgressiveOverloadChart data={stats.progressiveOverload} />
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No workout data available yet.</p>
                  <p className="text-sm">Start tracking workouts to see your progress!</p>
                </div>
              )}
            </CardContent>
          </Card>
          <Card className="shadow-md">
            <CardHeader>
              <CardTitle>Last Workout</CardTitle>
            </CardHeader>
            <CardContent>
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
                <p className="text-muted-foreground">You haven't done this exercise yet.</p>
              )}
            </CardContent>
          </Card>
          <Card className="shadow-md">
            <CardHeader>
              <CardTitle>Personal Best</CardTitle>
            </CardHeader>
            <CardContent>
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
                <p className="text-muted-foreground">No personal best recorded yet.</p>
              )}
            </CardContent>
          </Card>
          <Card className="shadow-md">
            <CardHeader>
              <CardTitle>Usage Statistics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-4">
                <div className="p-4 border rounded-lg">
                  <div className="text-sm font-medium text-muted-foreground">Times Used</div>
                  <div className="text-2xl font-bold text-primary">{exerciseType.times_used}</div>
                </div>
                {stats?.totalSets && (
                  <div className="p-4 border rounded-lg">
                    <div className="text-sm font-medium text-muted-foreground">Total Sets</div>
                    <div className="text-2xl font-bold text-secondary">{stats.totalSets}</div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default ExerciseTypeDetailsPage;