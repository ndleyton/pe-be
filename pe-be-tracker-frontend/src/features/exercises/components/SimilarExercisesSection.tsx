import { Link } from "react-router-dom";
import { Tag, Wrench } from "lucide-react";

import { Skeleton } from "@/shared/components/ui/skeleton";
import type {
  SimilarExercise,
  SimilarExercisesStrategy,
} from "@/features/exercises/api";

const matchReasonLabel: Record<SimilarExercise["match_reason"], string> = {
  same_primary_muscle: "Same primary muscle",
  same_primary_muscle_group: "Same muscle group",
};

const helperCopyForStrategy = (strategy: SimilarExercisesStrategy) => {
  if (strategy === "same_primary_muscle_then_group_by_times_used") {
    return "Popular alternatives that hit the same primary muscle, with nearby backfills when needed.";
  }

  return "Popular alternatives that hit the same primary muscle.";
};

interface SimilarExercisesSectionProps {
  suggestions: SimilarExercise[];
  strategy: SimilarExercisesStrategy;
  isLoading: boolean;
  hasError: boolean;
}

export const SimilarExercisesSection = ({
  suggestions,
  strategy,
  isLoading,
  hasError,
}: SimilarExercisesSectionProps) => {
  if (
    !isLoading &&
    !hasError &&
    suggestions.length === 0 &&
    strategy === "no_primary_muscle"
  ) {
    return null;
  }

  return (
    <section className="bg-card border-border/20 mt-8 rounded-2xl border p-6 text-left shadow-md">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Similar exercises</h2>
        <p className="text-muted-foreground text-sm">
          {helperCopyForStrategy(strategy)}
        </p>
      </div>

      {isLoading ? (
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={index}
              className="rounded-2xl border border-border/40 p-4"
            >
              <Skeleton className="mb-3 h-5 w-2/3" />
              <Skeleton className="mb-4 h-4 w-1/2" />
              <div className="flex gap-2">
                <Skeleton className="h-5 w-20 rounded-full" />
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {!isLoading && hasError ? (
        <p className="text-muted-foreground mt-6 text-sm">
          Couldn&apos;t load similar exercises right now.
        </p>
      ) : null}

      {!isLoading && !hasError && suggestions.length === 0 ? (
        <p className="text-muted-foreground mt-6 text-sm">
          No close alternatives yet.
        </p>
      ) : null}

      {!isLoading && !hasError && suggestions.length > 0 ? (
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {suggestions.map(({ exercise_type: exerciseType, match_reason }) => (
            <Link
              key={exerciseType.id}
              to={`/exercise-types/${exerciseType.id}`}
              className="group rounded-2xl border border-border/40 p-4 transition-colors hover:border-primary/40 hover:bg-muted/30"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-base font-semibold text-foreground">
                    {exerciseType.name}
                  </h3>
                  <p className="text-muted-foreground mt-1 text-xs font-medium uppercase tracking-[0.12em]">
                    {matchReasonLabel[match_reason]}
                  </p>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2 text-xs text-muted-foreground">
                {exerciseType.equipment ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1">
                    <Wrench className="h-3 w-3" />
                    <span className="capitalize">{exerciseType.equipment}</span>
                  </span>
                ) : null}
                {exerciseType.category ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1">
                    <Tag className="h-3 w-3" />
                    <span className="capitalize">{exerciseType.category}</span>
                  </span>
                ) : null}
              </div>

              {exerciseType.muscles && exerciseType.muscles.length > 0 ? (
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {exerciseType.muscles.slice(0, 3).map((muscle) => (
                    <span
                      key={muscle.id}
                      className="inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary/80"
                    >
                      {muscle.name}
                    </span>
                  ))}
                </div>
              ) : null}
            </Link>
          ))}
        </div>
      ) : null}
    </section>
  );
};
