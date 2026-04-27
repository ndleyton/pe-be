import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft, BookmarkPlus, Check, Share2 } from "lucide-react";
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
  const [hasCopied, setHasCopied] = useState(false);

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setHasCopied(true);
      setTimeout(() => setHasCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy link", err);
    }
  };
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
        <div className="flex shrink-0 items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleShare}
          >
            {hasCopied ? (
              <Check className="mr-2 h-4 w-4" />
            ) : (
              <Share2 className="mr-2 h-4 w-4" />
            )}
            {hasCopied ? "Copied!" : "Share workout"}
          </Button>
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
        {activity.exercises.map((exercise, exerciseIndex) => (
          <div
            key={exercise.id}
            className="rounded-2xl border border-border/40 bg-muted/20 p-4 shadow-sm transition-all hover:bg-muted/30"
          >
            <div className="mb-4 flex items-start justify-between gap-4 border-b border-border/10 pb-4">
              <div className="flex min-w-0 items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-border/40 bg-background text-xl font-black shadow-inner">
                  {exerciseIndex + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="break-words text-lg font-black leading-tight tracking-tight">
                    {exercise.exercise_type.name}
                  </h2>
                  <div className="mt-1.5 flex items-center gap-2">
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-primary">
                      {exercise.sets.length} set{exercise.sets.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-2 space-y-2">
              {exercise.sets.map((set, setIndex) => (
                <div
                  key={`${exercise.id}-${setIndex}`}
                  className="flex w-full items-start gap-3 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2.5 shadow-lg shadow-primary/5 backdrop-blur-sm"
                >
                  <span className="mt-0.5 text-[10px] font-black text-primary opacity-40">
                    {setIndex + 1}
                  </span>
                  <span className="min-w-0 break-words text-sm font-bold tracking-tight italic text-foreground opacity-90">
                    {setLabel(set)}
                  </span>
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
