import { Skeleton } from "@/shared/components/ui/skeleton";
import { DEFAULT_SKELETON_COUNT } from "@/shared/constants";
import { EXERCISE_SETS_GRID_CLASSES } from "@/features/exercises/lib/exerciseRow";
import { cn } from "@/lib/utils";

interface ExerciseListSkeletonProps {
  count?: number;
}

export const ExerciseListSkeleton = ({
  count = DEFAULT_SKELETON_COUNT,
}: ExerciseListSkeletonProps) => (
  <div className="space-y-6">
    {Array.from({ length: count }).map((_, i) => (
      <div
        key={i}
        className="mx-auto w-full max-w-2xl overflow-hidden rounded-2xl border-border/5 border-t-4 border-b-4 bg-card/80 shadow-lg backdrop-blur-sm shadow-black/5"
      >
        <div className="p-6 pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Skeleton className="h-8 w-8 shrink-0 rounded-lg bg-primary/20" />
              <div className="flex flex-col gap-1">
                <Skeleton className="h-5 w-32 sm:w-48 rounded-md" />
                <Skeleton className="h-3 w-20 opacity-40 rounded-sm" />
              </div>
            </div>
            <Skeleton className="h-8 w-8 rounded-md opacity-20" />
          </div>
        </div>

        <div className="p-4 pt-0">
          <div
            className={cn(
              "bg-card/50 border-border/10 mb-3 grid items-center gap-2 rounded-lg border-b px-2 py-1.5 sm:gap-4",
              EXERCISE_SETS_GRID_CLASSES,
            )}
          >
            <Skeleton className="h-3 w-6 mx-auto" />
            <Skeleton className="h-3 w-10 mx-auto" />
            <Skeleton className="h-3 w-10 mx-auto" />
            <Skeleton className="h-3 w-8 ml-auto mr-2" />
            <div />
          </div>

          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, j) => (
              <div
                key={j}
                className={cn(
                  "grid items-center gap-2 rounded-lg border border-transparent bg-muted/50 p-2.5 shadow-sm sm:gap-4",
                  EXERCISE_SETS_GRID_CLASSES,
                )}
              >
                <Skeleton className="h-8 w-8 rounded-lg" />
                <Skeleton className="h-8 w-full rounded-lg" />
                <Skeleton className="h-8 w-full rounded-lg" />
                <Skeleton className="h-10 w-10 rounded-xl" />
                <Skeleton className="h-8 w-8 rounded-lg" />
              </div>
            ))}
          </div>
        </div>
      </div>
    ))}
  </div>
);
