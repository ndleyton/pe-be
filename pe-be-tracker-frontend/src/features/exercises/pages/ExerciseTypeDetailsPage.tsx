import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import {
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { ArrowLeft, Image, ImagePlus, Plus } from "lucide-react";
import Fade from "embla-carousel-fade";
import {
  getExerciseTypeById,
  getExerciseTypeStats,
  releaseExerciseType,
  requestExerciseTypeEvaluation,
  updateExerciseType,
  type Exercise,
} from "@/features/exercises/api";
import { useAuthStore } from "@/stores";
import { lazy, Suspense } from "react";
import { createIntentPreload } from "@/shared/lib/createIntentPreload";

const ProgressiveOverloadChart = lazy(() =>
  import("@/features/exercises/components/ProgressiveOverloadChart/ProgressiveOverloadChart").then(
    (m) => ({ default: m.ProgressiveOverloadChart }),
  ),
);

const preloadProgressiveOverloadChart = createIntentPreload(() =>
  import("@/features/exercises/components/ProgressiveOverloadChart/ProgressiveOverloadChart"),
);
import { LastWorkoutInfo } from "@/features/exercises/components/LastWorkoutInfo/LastWorkoutInfo";
import { PersonalBestInfo } from "@/features/exercises/components/PersonalBestInfo/PersonalBestInfo";
import { addExerciseToCurrentWorkout } from "@/features/workouts";
import type { Workout } from "@/features/workouts/types";
import { Button } from "@/shared/components/ui/button";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/shared/components/ui/alert";
import { Badge } from "@/shared/components/ui/badge";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/shared/components/ui/carousel";
import { Input } from "@/shared/components/ui/input";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { Textarea } from "@/shared/components/ui/textarea";
import { DEFAULT_SKELETON_COUNT } from "@/shared/constants";

const ExerciseTypeDetailsPage = () => {
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());
  const [addExerciseError, setAddExerciseError] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [editValues, setEditValues] = useState({
    name: "",
    description: "",
    equipment: "",
    category: "",
    instructions: "",
  });
  const [containerRatio, setContainerRatio] = useState<string>("16 / 9");
  const [firstImageLoaded, setFirstImageLoaded] = useState<boolean>(false);
  const { exerciseTypeId } = useParams<{ exerciseTypeId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isSuperuser = Boolean(useAuthStore((state) => state.user?.is_superuser));
  const currentUserId = currentUser?.id ?? null;

  const {
    data: exerciseType,
    isLoading: isLoadingExerciseType,
    error: exerciseTypeError,
  } = useQuery({
    queryKey: ["exerciseType", exerciseTypeId],
    queryFn: () => getExerciseTypeById(exerciseTypeId!),
    enabled: !!exerciseTypeId,
  });

  const {
    data: stats,
    isLoading: isLoadingStats,
    error: statsError,
  } = useQuery({
    queryKey: ["exerciseTypeStats", exerciseTypeId],
    queryFn: () => getExerciseTypeStats(exerciseTypeId!),
    enabled: !!exerciseTypeId && !!exerciseType && isAuthenticated,
    retry: 1,
  });

  useEffect(() => {
    if (!exerciseType) {
      return;
    }
    setEditValues({
      name: exerciseType.name ?? "",
      description: exerciseType.description ?? "",
      equipment: exerciseType.equipment ?? "",
      category: exerciseType.category ?? "",
      instructions: exerciseType.instructions ?? "",
    });
  }, [exerciseType]);

  const addMutation = useMutation({
    mutationFn: () =>
      addExerciseToCurrentWorkout({
        exercise_type_id: Number(exerciseTypeId),
      }),
    onMutate: async () => {
      // Clear any previous error
      setAddExerciseError(null);
      if (!exerciseType) return {};

      const workoutsQuery = queryClient.getQueryData<
        { data: Workout[]; next_cursor?: number | null }
      >(["workouts"]);

      const allWorkouts = workoutsQuery?.data ?? [];
      const activeWorkout = [...allWorkouts]
        .reverse()
        .find((workout) => !workout.end_time);

      if (!activeWorkout) return {};

      const workoutId = activeWorkout.id;
      await queryClient.cancelQueries({
        queryKey: ["exercises", workoutId],
      });

      const prevExercises = queryClient.getQueryData<Exercise[]>([
        "exercises",
        workoutId,
      ]);
      const hadPrev = prevExercises !== undefined;

      const now = new Date().toISOString();
      const optimisticId = `optimistic-${now}-${exerciseType.id}`;
      const optimisticExercise: Exercise = {
        id: optimisticId,
        timestamp: now,
        notes: null,
        exercise_type_id: exerciseType.id,
        workout_id: workoutId,
        created_at: now,
        updated_at: now,
        exercise_type: exerciseType,
        exercise_sets: [],
      };

      queryClient.setQueryData(
        ["exercises", workoutId],
        (old: Exercise[] | undefined) =>
          old ? [...old, optimisticExercise] : [optimisticExercise],
      );

      return { prevExercises, hadPrev, workoutId, optimisticId };
    },
    onSuccess: (workout) => {
      navigate(`/workouts/${workout.id}`, {
        state: { scrollToBottomOnLoad: true },
      });

      // Update cache with real data and invalidate exercises to refresh
      queryClient.setQueryData(["workout", workout.id.toString()], workout);
      queryClient.invalidateQueries({
        queryKey: ["exercises", workout.id.toString()],
      });
    },
    onError: (error, _vars, ctx) => {
      console.error("Failed to add exercise to workout:", error);
      if (ctx?.workoutId) {
        const exercisesQueryKey = ["exercises", ctx.workoutId] as const;
        queryClient.setQueryData(
          exercisesQueryKey,
          (old: Exercise[] | undefined) =>
            old?.filter(
              (exercise) => String(exercise.id) !== String(ctx.optimisticId),
            ) ?? old,
        );

        if (ctx.hadPrev) {
          queryClient.setQueryData(exercisesQueryKey, ctx.prevExercises);
        } else {
          const current = queryClient.getQueryData<Exercise[]>(exercisesQueryKey);
          if (!current || current.length === 0) {
            queryClient.removeQueries({
              queryKey: exercisesQueryKey,
              exact: true,
            });
          }
        }
      }
      setAddExerciseError(
        error instanceof Error
          ? error.message
          : "Failed to add exercise to workout. Please try again.",
      );
    },
  });

  const updateMutation = useMutation({
    mutationFn: () =>
      updateExerciseType(Number(exerciseTypeId), {
        name: editValues.name.trim(),
        description: editValues.description.trim() || null,
        equipment: editValues.equipment.trim() || null,
        category: editValues.category.trim() || null,
        instructions: editValues.instructions.trim() || null,
      }),
    onMutate: () => {
      setEditError(null);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["exerciseType", exerciseTypeId],
      });
      await queryClient.invalidateQueries({ queryKey: ["exerciseTypes"] });
    },
    onError: (error) => {
      setEditError(
        error instanceof Error
          ? error.message
          : "Failed to save exercise type changes.",
      );
    },
  });

  const requestEvaluationMutation = useMutation({
    mutationFn: () => requestExerciseTypeEvaluation(Number(exerciseTypeId)),
    onMutate: () => {
      setEditError(null);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["exerciseType", exerciseTypeId],
      });
      await queryClient.invalidateQueries({ queryKey: ["exerciseTypes"] });
    },
    onError: (error) => {
      setEditError(
        error instanceof Error
          ? error.message
          : "Failed to request evaluation.",
      );
    },
  });

  const releaseMutation = useMutation({
    mutationFn: () => releaseExerciseType(Number(exerciseTypeId)),
    onMutate: () => {
      setEditError(null);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["exerciseType", exerciseTypeId],
      });
      await queryClient.invalidateQueries({ queryKey: ["exerciseTypes"] });
    },
    onError: (error) => {
      setEditError(
        error instanceof Error
          ? error.message
          : "Failed to release exercise type.",
      );
    },
  });

  // Compute valid images each render; safe even when loading
  const validImages =
    exerciseType?.images?.filter((img) => !failedImages.has(img)) || [];
  const firstImageUrl = validImages[0];
  // Preload the first valid image to set a single container aspect-ratio.
  useEffect(() => {
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

  // Preload heavy chart after a small delay
  useEffect(() => {
    const preloadTimeout = setTimeout(() => {
      preloadProgressiveOverloadChart();
    }, 2000);
    return () => clearTimeout(preloadTimeout);
  }, []);

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
      <div
        className="mx-auto max-w-4xl p-4 text-center md:p-6 lg:p-8"
        aria-busy="true"
        aria-live="polite"
      >
        {/* Header skeleton matching details layout */}
        <div className="mb-6">
          {/* Title Row */}
          <div className="mb-4 flex items-center gap-3 sm:gap-4">
            <Skeleton className="h-10 w-10 shrink-0 rounded" />
            <Skeleton className="h-8 min-w-0 flex-1" />
          </div>
          {/* Muscles and Button Row */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 flex-1 flex-wrap gap-2">
              <Skeleton className="h-6 w-20 rounded-full" />
              <Skeleton className="h-6 w-24 rounded-full" />
              <Skeleton className="h-6 w-16 rounded-full" />
            </div>
            <Skeleton className="h-9 w-28 shrink-0 rounded" />
          </div>
        </div>

        {/* Keep spinner for tests while showing skeletons */}
        <div className="flex justify-center py-4" role="status">
          <span className="loading loading-spinner loading-lg"></span>
        </div>

        <div className="grid grid-cols-1 gap-6 text-left lg:grid-cols-2 lg:gap-8">
          <div className="space-y-6">
            <div className="bg-muted/50 border-border/20 h-64 rounded-2xl border shadow-md"></div>
            <div className="bg-card border-border/20 rounded-2xl border p-6 shadow-md">
              <Skeleton className="mb-2 h-4 w-full" />
              <Skeleton className="mb-2 h-4 w-5/6" />
              <Skeleton className="h-4 w-4/5" />
            </div>
          </div>
          <div className="space-y-6">
            {Array.from({ length: DEFAULT_SKELETON_COUNT }).map((_, i) => (
              <div
                key={i}
                className="bg-card border-border/20 rounded-2xl border p-6 shadow-md"
              >
                <Skeleton className="mb-4 h-6 w-56" />
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
          <AlertDescription>Exercise type not found.</AlertDescription>
        </Alert>
      </div>
    );
  }

  const statusLabel =
    exerciseType.status === "candidate"
      ? "Candidate"
      : exerciseType.status === "in_review"
        ? "In Review"
        : null;
  const isOwner = currentUserId != null && exerciseType.owner_id === currentUserId;
  const isEditable =
    isAuthenticated &&
    exerciseType.status !== "released" &&
    (isOwner || isSuperuser);
  const canRequestEvaluation =
    isAuthenticated &&
    isOwner &&
    exerciseType.status === "candidate" &&
    !requestEvaluationMutation.isPending;
  const canRelease =
    isSuperuser &&
    exerciseType.status !== "released" &&
    !releaseMutation.isPending;

  return (
    <div className="mx-auto max-w-4xl p-4 text-center md:p-6 lg:p-8">
      {/* Header */}
      <div className="mb-6">
        {/* Title Row */}
        <div className="mb-4 flex items-start gap-3 sm:gap-4">
          <Button variant="ghost" size="icon" asChild className="mt-1 shrink-0">
            <Link to="/exercise-types">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <h1 className="min-w-0 text-2xl leading-tight font-bold break-words sm:text-3xl">
            {exerciseType.name}
          </h1>
          {statusLabel ? (
            <Badge variant="secondary" className="mt-1 shrink-0">
              {statusLabel}
            </Badge>
          ) : null}
        </div>

        {/* Muscles and Button Row */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-1 flex-wrap gap-2">
            {exerciseType.muscles && exerciseType.muscles.length > 0
              ? exerciseType.muscles.map((muscle) => (
                <span
                  key={muscle.id}
                  className="focus:ring-ring bg-secondary text-secondary-foreground hover:bg-secondary/80 inline-flex items-center rounded-full border border-transparent px-2.5 py-0.5 text-xs font-semibold transition-colors focus:ring-2 focus:ring-offset-2 focus:outline-none"
                >
                  {muscle.name}
                </span>
              ))
              : null}
          </div>
          <div className="flex shrink-0 gap-2">
            {isSuperuser ? (
              <Button size="sm" variant="outline" asChild>
                <Link to={`/exercise-types/${exerciseTypeId}/admin-images`}>
                  <ImagePlus className="mr-1 h-4 w-4" />
                  Manage Images
                </Link>
              </Button>
            ) : null}
            {isAuthenticated ? (
              <Button
                size="sm"
                className="shrink-0"
                onClick={() => addMutation.mutate()}
                disabled={addMutation.isPending}
              >
                {addMutation.isPending ? (
                  "Adding..."
                ) : (
                  <>
                    <Plus className="mr-1 h-4 w-4" />
                    Add to Workout
                  </>
                )}
              </Button>
            ) : null}
          </div>
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
          <AlertDescription>{addExerciseError}</AlertDescription>
        </Alert>
      )}

      {editError && (
        <Alert variant="destructive" className="mb-6">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{editError}</AlertDescription>
        </Alert>
      )}

      {isEditable ? (
        <div className="bg-card border-border/20 mb-6 rounded-2xl border p-6 text-left shadow-md">
          <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold">Edit Exercise Type</h2>
              <p className="text-muted-foreground text-sm">
                Non-released exercises stay private to you until an admin approves them.
              </p>
            </div>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:justify-end">
              {canRequestEvaluation ? (
                <Button
                  variant="outline"
                  className="w-full sm:w-auto"
                  onClick={() => requestEvaluationMutation.mutate()}
                >
                  {requestEvaluationMutation.isPending
                    ? "Requesting..."
                    : "Request Evaluation"}
                </Button>
              ) : null}
              {canRelease ? (
                <Button
                  variant="outline"
                  className="w-full sm:w-auto"
                  onClick={() => releaseMutation.mutate()}
                >
                  {releaseMutation.isPending ? "Releasing..." : "Release"}
                </Button>
              ) : null}
              <Button className="w-full sm:w-auto" onClick={() => updateMutation.mutate()}>
                {updateMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-2">
              <span className="text-sm font-medium">Name</span>
              <Input
                value={editValues.name}
                onChange={(event) =>
                  setEditValues((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
              />
            </label>
            <label className="grid gap-2">
              <span className="text-sm font-medium">Equipment</span>
              <Input
                value={editValues.equipment}
                onChange={(event) =>
                  setEditValues((current) => ({
                    ...current,
                    equipment: event.target.value,
                  }))
                }
              />
            </label>
            <label className="grid gap-2">
              <span className="text-sm font-medium">Category</span>
              <Input
                value={editValues.category}
                onChange={(event) =>
                  setEditValues((current) => ({
                    ...current,
                    category: event.target.value,
                  }))
                }
              />
            </label>
            <div />
            <label className="grid gap-2 md:col-span-2">
              <span className="text-sm font-medium">Description</span>
              <Textarea
                value={editValues.description}
                onChange={(event) =>
                  setEditValues((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
              />
            </label>
            <label className="grid gap-2 md:col-span-2">
              <span className="text-sm font-medium">Instructions</span>
              <Textarea
                value={editValues.instructions}
                onChange={(event) =>
                  setEditValues((current) => ({
                    ...current,
                    instructions: event.target.value,
                  }))
                }
                rows={5}
              />
            </label>
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-6 text-left lg:grid-cols-2 lg:gap-8">
        <div className="space-y-6">
          {/* Exercise Images */}
          <div className="overflow-hidden">
            <div
              className="bg-muted/50 border-border/20 flex items-center justify-center overflow-hidden rounded-2xl border shadow-md"
              style={{ aspectRatio: containerRatio }}
              data-testid="exercise-carousel-container"
            >
              {(() => {
                if (validImages.length > 0) {
                  if (!firstImageLoaded) {
                    return (
                      <div className="flex h-full w-full items-center justify-center">
                        <span className="loading loading-spinner loading-md"></span>
                      </div>
                    );
                  }
                  return (
                    <Carousel
                      className="h-full w-full"
                      opts={{
                        loop: true,
                        align: "center",
                        containScroll: false,
                      }}
                      plugins={[Fade()]}
                    >
                      <CarouselContent>
                        {validImages.map((imageUrl, index) => (
                          <CarouselItem key={imageUrl}>
                            <img
                              src={imageUrl}
                              alt={`${exerciseType.name} - Image ${index + 1}`}
                              className="h-full w-full object-contain"
                              onError={() => {
                                setFailedImages((prev) =>
                                  new Set(prev).add(imageUrl),
                                );
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
                    <div className="text-muted-foreground flex flex-col items-center justify-center text-center">
                      <Image className="mx-auto mb-2 h-16 w-16" />
                      <p>Exercise image coming soon</p>
                    </div>
                  );
                }
              })()}
            </div>
          </div>

          <div className="bg-card border-border/20 rounded-2xl border p-6 shadow-md">
            <p className="text-muted-foreground leading-relaxed whitespace-pre-line">
              {exerciseType.description ||
                "No description available for this exercise type."}
            </p>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-card border-border/20 rounded-2xl border p-6 shadow-md">
            <h2 className="mb-4 text-lg font-semibold">Progressive Overload</h2>
            {isLoadingStats ? (
              <>
                <div className="flex justify-center py-4">
                  <span className="loading loading-spinner loading-md"></span>
                </div>
                <Skeleton className="h-48 w-full" />
              </>
            ) : stats?.progressiveOverload &&
              stats.progressiveOverload.length > 0 ? (
              <Suspense fallback={<Skeleton className="h-48 w-full" />}>
                <ProgressiveOverloadChart
                  data={stats.progressiveOverload}
                  intensityUnit={stats.intensityUnit}
                />
              </Suspense>
            ) : (
              <div className="text-muted-foreground py-8 text-center">
                <p>No workout data available yet.</p>
                <p className="text-sm">
                  Start tracking workouts to see your progress!
                </p>
              </div>
            )}
          </div>

          <div className="bg-card border-border/20 rounded-2xl border p-6 shadow-md">
            <h2 className="mb-4 text-lg font-semibold">Last Workout</h2>
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
              <p className="text-muted-foreground">
                You haven't done this exercise yet.
              </p>
            )}
          </div>

          <div className="bg-card border-border/20 rounded-2xl border p-6 shadow-md">
            <h2 className="mb-4 text-lg font-semibold">Personal Best</h2>
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
              <p className="text-muted-foreground">
                No personal best recorded yet.
              </p>
            )}
          </div>

          {stats?.totalSets ? (
            <div className="bg-card border-border/20 rounded-2xl border p-6 shadow-md">
              <h2 className="mb-4 text-lg font-semibold">Usage Statistics</h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                <div className="bg-muted/50 rounded-xl p-5">
                  <div className="text-muted-foreground mb-1 text-sm font-medium">
                    Total Sets
                  </div>
                  <div className="text-2xl font-bold">{stats.totalSets}</div>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default ExerciseTypeDetailsPage;
