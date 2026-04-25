import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft, BookmarkPlus } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";

import {
  getPublicActivity,
  savePublicActivityAsRoutine,
} from "@/features/profile/api";
import type { PublicExerciseSet } from "@/features/profile/types";
import { useAuthStore } from "@/stores";
import { Alert, AlertDescription, AlertTitle } from "@/shared/components/ui/alert";
import { Button } from "@/shared/components/ui/button";

const formatPublicDecimal = (value: string | number): string => {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return String(value);
  }
  return String(numericValue);
};

const setLabel = (set: PublicExerciseSet) => {
  const parts = [];
  if (set.reps != null) parts.push(`${set.reps} reps`);
  if (set.duration_seconds != null) parts.push(`${set.duration_seconds}s`);
  if (set.intensity != null) {
    parts.push(
      `${formatPublicDecimal(set.intensity)} ${
        set.intensity_unit?.abbreviation ?? ""
      }`.trim(),
    );
  }
  return parts.join(" · ") || "Set";
};

const PublicActivityPage = () => {
  const { username = "", workoutId = "" } = useParams();
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  const activityQuery = useQuery({
    queryKey: ["public-profile-activity", username, workoutId],
    queryFn: () => getPublicActivity(username, workoutId),
    enabled: Boolean(username && workoutId),
  });

  const saveMutation = useMutation({
    mutationFn: () => savePublicActivityAsRoutine(username, workoutId),
    onSuccess: (routine) => navigate(`/routines/${routine.id}`),
  });

  if (activityQuery.isPending) {
    return <div className="mx-auto max-w-4xl px-4 py-8">Loading workout...</div>;
  }

  if (activityQuery.error || !activityQuery.data) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <Alert variant="destructive">
          <AlertTitle>Workout unavailable</AlertTitle>
          <AlertDescription>
            This public workout does not exist or is no longer visible.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const activity = activityQuery.data;

  return (
    <div className="mx-auto min-h-screen max-w-4xl px-4 py-8 text-left">
      <div className="mb-6 flex items-center gap-3">
        <Button asChild variant="ghost" size="icon" aria-label="Back to profile">
          <Link to={`/u/${username}`}>
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-3xl font-black tracking-tight">
            {activity.name || activity.workout_type.name}
          </h1>
          <p className="text-sm font-bold text-muted-foreground">@{username}</p>
        </div>
        <Button
          type="button"
          onClick={() =>
            isAuthenticated
              ? saveMutation.mutate()
              : navigate(`/login?returnTo=${encodeURIComponent(location.pathname)}`)
          }
          disabled={saveMutation.isPending}
        >
          <BookmarkPlus className="mr-2 h-4 w-4" />
          {saveMutation.isPending ? "Saving..." : "Save routine"}
        </Button>
      </div>

      {saveMutation.error ? (
        <Alert variant="destructive" className="mb-6">
          <AlertTitle>Save failed</AlertTitle>
          <AlertDescription>
            We could not save this workout as a routine.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-border p-3">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Type
          </p>
          <p className="mt-1 font-black">{activity.workout_type.name}</p>
        </div>
        <div className="rounded-lg border border-border p-3">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Exercises
          </p>
          <p className="mt-1 font-black">{activity.exercise_count}</p>
        </div>
        <div className="rounded-lg border border-border p-3">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Sets
          </p>
          <p className="mt-1 font-black">{activity.set_count}</p>
        </div>
        <div className="rounded-lg border border-border p-3">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Duration
          </p>
          <p className="mt-1 font-black">
            {activity.duration_seconds
              ? `${Math.round(activity.duration_seconds / 60)} min`
              : "n/a"}
          </p>
        </div>
      </div>

      <section className="space-y-4">
        {activity.exercises.map((exercise) => (
          <div
            key={exercise.id}
            className="rounded-lg border border-border p-4"
          >
            <h2 className="font-black">{exercise.exercise_type.name}</h2>
            <div className="mt-3 space-y-2">
              {exercise.sets.map((set, index) => (
                <div
                  key={`${exercise.id}-${index}`}
                  className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-2 text-sm"
                >
                  <span className="font-bold">Set {index + 1}</span>
                  <span className="text-muted-foreground">{setLabel(set)}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
};

export default PublicActivityPage;
