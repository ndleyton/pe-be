import { Skeleton } from "@/shared/components/ui/skeleton";
import { DEFAULT_SKELETON_COUNT } from "@/shared/constants";

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
        className="bg-card/40 border-border/20 rounded-2xl border-t-4 border-t-rose-500/10 border-b-4 border-l border-r p-5 shadow-lg backdrop-blur-sm"
      >
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-4">
            <Skeleton className="h-10 w-10 shrink-0 rounded-xl" />
            <div className="flex-1">
              <Skeleton className="mb-2 h-5 w-32 sm:w-48" />
              <Skeleton className="h-3 w-20 opacity-50" />
            </div>
          </div>
          <Skeleton className="h-4 w-12 rounded opacity-50" />
        </div>

        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, j) => (
            <div key={j} className="flex items-center gap-2">
              <Skeleton className="h-8 flex-1 rounded-lg" />
              <Skeleton className="h-8 flex-1 rounded-lg" />
              <Skeleton className="h-8 flex-1 rounded-lg" />
              <Skeleton className="h-8 w-8 rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    ))}
  </div>
);
