import React, { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Image, Plus } from 'lucide-react';
import Fade from 'embla-carousel-fade';
import { getExerciseTypeById, getExerciseTypeStats } from '@/features/exercises/api';
import { ProgressiveOverloadChart } from '@/features/exercises/components';
import { LastWorkoutInfo, PersonalBestInfo } from '@/features/exercises/components';
import { addExerciseToCurrentWorkout } from '@/features/workouts';
import { Button } from '@/shared/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/shared/components/ui/card';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/shared/components/ui/alert';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/shared/components/ui/carousel';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { DEFAULT_SKELETON_COUNT } from '@/shared/constants';

const ExerciseTypeDetailsPage: React.FC = () => {
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());
  const [addExerciseError, setAddExerciseError] = useState<string | null>(null);
  const [containerRatio, setContainerRatio] = useState<string>('16 / 9');
  const [firstImageLoaded, setFirstImageLoaded] = useState<boolean>(false);
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
    onMutate: async () => {
      // Clear any previous error
      setAddExerciseError(null);
      return {};
    },
    onSuccess: (workout) => {
      navigate(`/workouts/${workout.id}`);
      
      // Update cache with real data and invalidate exercises to refresh
      queryClient.setQueryData(['workout', workout.id.toString()], workout);
      queryClient.invalidateQueries({ queryKey: ['exercises', workout.id.toString()] });
    },
    onError: (error) => {
      console.error('Failed to add exercise to workout:', error);
      setAddExerciseError(
        error instanceof Error 
          ? error.message 
          : 'Failed to add exercise to workout. Please try again.'
      );
    }
  });

  // Compute valid images each render; safe even when loading
  const validImages = exerciseType?.images?.filter((img) => !failedImages.has(img)) || [];
  const firstImageUrl = validImages[0];

  // Preload the first valid image to set a single container aspect-ratio.
  React.useEffect(() => {
    setFirstImageLoaded(false);
    if (!firstImageUrl) return;
    const url = firstImageUrl;
    const img = new window.Image();
    img.onload = () => {
      if (img.naturalWidth && img.naturalHeight) {
        setContainerRatio(`${img.naturalWidth} / ${img.naturalHeight}`);
      }
      setFirstImageLoaded(true);
    };
    img.onerror = () => {
      // Mark this image as failed so we can try the next one
      setFailedImages((prev) => new Set(prev).add(url));
    };
    img.src = url;
  }, [firstImageUrl]);

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
      <div className="max-w-4xl mx-auto p-4 md:p-6 lg:p-8 text-center" aria-busy="true" aria-live="polite">
        {/* Header skeleton matching details layout */}
        <div className="mb-6">
          {/* Title Row */}
          <div className="flex items-center gap-3 sm:gap-4 mb-4">
            <Skeleton className="h-10 w-10 rounded shrink-0" />
            <Skeleton className="h-8 flex-1 min-w-0" />
          </div>
          {/* Muscles and Button Row */}
          <div className="flex items-center gap-3 justify-between">
            <div className="flex flex-wrap gap-2 flex-1 min-w-0">
              <Skeleton className="h-6 w-20 rounded-full" />
              <Skeleton className="h-6 w-24 rounded-full" />
              <Skeleton className="h-6 w-16 rounded-full" />
            </div>
            <Skeleton className="h-9 w-28 rounded shrink-0" />
          </div>
        </div>

        {/* Keep spinner for tests while showing skeletons */}
        <div className="flex justify-center py-4" role="status">
          <span className="loading loading-spinner loading-lg"></span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-2 text-left">
          <div className="space-y-6">
            <div className="bg-card rounded-lg p-6 border border-border">
              <Skeleton className="h-64 w-full rounded-lg" />
            </div>
            <div className="bg-card rounded-lg p-6 border border-border">
              <Skeleton className="h-6 w-40 mb-4" />
              <Skeleton className="h-4 w-full mb-2" />
              <Skeleton className="h-4 w-5/6" />
            </div>
            <div className="bg-card rounded-lg p-6 border border-border">
              <Skeleton className="h-6 w-48 mb-4" />
              <div className="flex gap-2 flex-wrap">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-6 w-24 rounded-full" />
                ))}
              </div>
            </div>
          </div>
          <div className="space-y-6">
            {Array.from({ length: DEFAULT_SKELETON_COUNT }).map((_, i) => (
              <div key={i} className="bg-card rounded-lg p-6 border border-border">
                <Skeleton className="h-6 w-56 mb-4" />
                <Skeleton className="h-40 w-full" />
              </div>
            ))}
          </div>
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
    <div className="max-w-4xl mx-auto p-4 md:p-6 lg:p-8 text-center">
      {/* Header */}
      <div className="mb-6">
        {/* Title Row */}
        <div className="flex items-center gap-3 sm:gap-4 mb-4">
          <Button variant="ghost" size="icon" asChild className="shrink-0">
            <Link to="/exercise-types">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <h1 className="text-2xl sm:text-3xl font-bold break-words min-w-0">{exerciseType.name}</h1>
        </div>

        {/* Muscles and Button Row */}
        <div className="flex items-center gap-3 justify-between">
          <div className="flex flex-wrap gap-2 flex-1 min-w-0">
            {exerciseType.muscles && exerciseType.muscles.length > 0 ? (
              exerciseType.muscles.map((muscle) => (
                <span key={muscle.id} className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80">
                  {muscle.name}
                </span>
              ))
            ) : null}
          </div>
          <Button
            size="sm"
            className="shrink-0"
            onClick={() => addMutation.mutate()}
            disabled={addMutation.isPending}
          >
            {addMutation.isPending ? (
              'Adding...'
            ) : (
              <>
                <Plus className="h-4 w-4 mr-1" />
                Add to Workout
              </>
            )}
          </Button>
        </div>
      </div>

      {statsError && (
        <Alert variant="destructive" className="mb-6">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            Error loading exercise statistics. Please try again later.
          </AlertDescription>
        </Alert>
      )}

      {addExerciseError && (
        <Alert variant="destructive" className="mb-6">
          <AlertTitle>Error Adding Exercise</AlertTitle>
          <AlertDescription>
            {addExerciseError}
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-6">
          {/* Exercise Images */}
          <Card className="shadow-md">
            <CardContent className="pt-6">
              <div
                className="bg-muted rounded-lg flex items-center justify-center overflow-hidden"
                style={{ aspectRatio: containerRatio }}
                data-testid="exercise-carousel-container"
              >
                {(() => {
                  if (validImages.length > 0) {
                    if (!firstImageLoaded) {
                      return (
                        <div className="w-full h-full flex items-center justify-center">
                          <span className="loading loading-spinner loading-md"></span>
                        </div>
                      );
                    }
                    return (
                      <Carousel
                        className="w-full h-full"
                        opts={{
                          loop: true,
                          align: 'center',
                          containScroll: false
                        }}
                        plugins={[Fade()]}
                      >
                        <CarouselContent>
                          {validImages.map((imageUrl, index) => (
                            <CarouselItem key={imageUrl}>
                              <img
                                src={imageUrl}
                                alt={`${exerciseType.name} - Image ${index + 1}`}
                                className="w-full h-full object-contain"
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
        </div>

        <div className="space-y-6">
          <Card className="shadow-md">
            <CardHeader>
              <CardTitle>Progressive Overload</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingStats ? (
                <>
                  <div className="flex justify-center py-4">
                    <span className="loading loading-spinner loading-md"></span>
                  </div>
                  <Skeleton className="h-48 w-full" />
                </>
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
                <>
                  <div className="flex justify-center py-2">
                    <span className="loading loading-spinner loading-sm"></span>
                  </div>
                  <Skeleton className="h-24 w-full" />
                </>
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
                <>
                  <div className="flex justify-center py-2">
                    <span className="loading loading-spinner loading-sm"></span>
                  </div>
                  <Skeleton className="h-20 w-full" />
                </>
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
