import { MessageCircle } from "lucide-react";
import { ExerciseSummaryCard } from "./ExerciseSummaryCard";

import { Button } from "@/shared/components/ui/button";
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
  onAskPersonalBestie: () => void;
}

export const SimilarExercisesSection = ({
  suggestions,
  strategy,
  isLoading,
  hasError,
  onAskPersonalBestie,
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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">Alternatives</h2>
          <p className="text-muted-foreground text-sm">
            {helperCopyForStrategy(strategy)}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          className="rounded-xl"
          onClick={onAskPersonalBestie}
        >
          <MessageCircle className="mr-2 h-4 w-4" />
          Ask personal bestie
        </Button>
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
          Couldn&apos;t load alternatives right now.
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
            <ExerciseSummaryCard
              key={exerciseType.id}
              id={exerciseType.id}
              name={exerciseType.name}
              description={null}
              equipment={exerciseType.equipment}
              category={exerciseType.category}
              muscles={exerciseType.muscles}
              subtitle={matchReasonLabel[match_reason]}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
};
