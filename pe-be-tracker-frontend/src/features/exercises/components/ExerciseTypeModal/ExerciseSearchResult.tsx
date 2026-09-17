import { Plus } from "lucide-react";
import type { ExerciseType } from "@/features/exercises/api";
import type { GuestExerciseType } from "@/stores";
import { parseExerciseName } from "@/features/exercises/lib/parseExerciseName";
import { MUSCLE_DISPLAY_LIMIT } from "@/shared/constants";

interface ExerciseSearchResultProps {
  exerciseType: ExerciseType | GuestExerciseType;
  onSelect: (exerciseType: ExerciseType | GuestExerciseType) => void;
}

export function ExerciseSearchResult({ exerciseType, onSelect }: ExerciseSearchResultProps) {
  const { baseName, variation } = parseExerciseName(exerciseType.name);
  const muscles = "muscles" in exerciseType && Array.isArray(exerciseType.muscles)
    ? exerciseType.muscles
    : [];

  return (
    <button
      type="button"
      aria-label={exerciseType.name}
      onClick={() => onSelect(exerciseType)}
      className="group flex w-full items-start gap-3 rounded-2xl border border-border/40 bg-card/60 p-4 text-left transition-colors hover:bg-accent/60 hover:border-primary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
    >
      <div className="flex min-w-0 flex-1 flex-col self-stretch">
        {/* Reserve two lines, but allow large text and unusually long names to grow.
            The parent grid keeps result rows equal in height without clipping names. */}
        <h4 className="min-h-[2lh] text-base leading-snug font-bold text-foreground [overflow-wrap:anywhere] group-hover:text-primary">
          {baseName}
        </h4>
        <div className="mt-1 min-h-[1lh] text-sm leading-snug font-semibold text-primary [overflow-wrap:anywhere]">
          {variation}
        </div>
        <div className="mt-2 flex min-h-5 flex-wrap items-start gap-1.5">
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
      </div>
      <Plus aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground group-hover:text-primary" />
    </button>
  );
}
