import { Plus } from "lucide-react";
import type { ExerciseType } from "@/features/exercises/api";
import type { GuestExerciseType } from "@/stores";
import { parseExerciseName } from "@/features/exercises/lib/parseExerciseName";
import { MUSCLE_DISPLAY_LIMIT } from "@/shared/constants";
import { Skeleton } from "@/shared/components/ui/skeleton";

interface ExerciseSearchResultProps {
  exerciseType: ExerciseType | GuestExerciseType;
  onSelect: (exerciseType: ExerciseType | GuestExerciseType) => void;
  disabled?: boolean;
}

export function ExerciseSearchResult({
  exerciseType,
  onSelect,
  disabled = false,
}: ExerciseSearchResultProps) {
  const { baseName, variation } = parseExerciseName(exerciseType.name);
  const muscles = "muscles" in exerciseType && Array.isArray(exerciseType.muscles)
    ? exerciseType.muscles
    : [];

  return (
    <button
      type="button"
      disabled={disabled}
      aria-label={exerciseType.name}
      onClick={() => onSelect(exerciseType)}
      className="group flex w-full items-start gap-3 rounded-2xl border border-border/40 bg-card/60 px-4 py-3 text-left transition-colors hover:bg-accent/60 hover:border-primary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
    >
      <div className="flex min-w-0 flex-1 flex-col self-stretch">
        {/* The name and optional suffix share a two-line minimum, rather than
            reserving empty lines for metadata that may not exist. */}
        <div className="flex min-h-[2lh] flex-col justify-center text-base leading-snug">
          <h4 className="line-clamp-2 font-bold text-foreground [overflow-wrap:anywhere] group-hover:text-primary">
            {baseName}
          </h4>
          {variation && (
            <div className="line-clamp-1 text-sm leading-snug font-semibold text-primary [overflow-wrap:anywhere]">
              {variation}
            </div>
          )}
        </div>
        {muscles.length > 0 && (
          <div className="mt-1.5 flex flex-wrap items-start gap-1.5">
            {muscles.slice(0, MUSCLE_DISPLAY_LIMIT).map((muscle) => (
              <span key={muscle.id} className="rounded-lg border border-border/30 bg-secondary/80 px-2 py-0.5 text-[10px] font-bold text-secondary-foreground [overflow-wrap:anywhere]">
                {muscle.name}
              </span>
            ))}
            {muscles.length > MUSCLE_DISPLAY_LIMIT && (
              <span className="rounded-lg bg-secondary/50 px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                +{muscles.length - MUSCLE_DISPLAY_LIMIT}
              </span>
            )}
          </div>
        )}
      </div>
      <Plus aria-hidden="true" className="mt-3 h-5 w-5 shrink-0 text-muted-foreground group-hover:text-primary" />
    </button>
  );
}

export function ExerciseSearchResultSkeleton() {
  return (
    <div
      data-slot="skeleton"
      data-testid="exercise-search-result-skeleton"
      className="bg-card/40 border-border/40 flex w-full items-start gap-3 rounded-2xl border px-4 py-3"
    >
      <div className="flex min-w-0 flex-1 flex-col self-stretch">
        <div className="flex min-h-[2lh] flex-col justify-center text-base leading-snug">
          <Skeleton className="h-4 w-3/5" />
        </div>
        <div className="mt-1.5 flex flex-wrap items-start gap-1.5">
          <Skeleton className="h-4 w-12 rounded-lg" />
          <Skeleton className="h-4 w-16 rounded-lg" />
        </div>
      </div>
      <Skeleton className="mt-3 h-5 w-5 shrink-0 rounded" />
    </div>
  );
}
