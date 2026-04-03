import { Skeleton } from "@/shared/components/ui/skeleton";
import { DEFAULT_SKELETON_COUNT } from "@/shared/constants";

interface WorkoutListSkeletonProps {
  count?: number;
}

export const WorkoutListSkeleton = ({
  count = DEFAULT_SKELETON_COUNT,
}: WorkoutListSkeletonProps) => (
  <div className="space-y-4 pt-4">
    {Array.from({ length: count }).map((_, i) => (
      <div
        key={i}
        className="bg-card/40 border-border/20 rounded-2xl border p-4 sm:p-5 shadow-sm backdrop-blur-sm"
      >
        <div className="flex items-center gap-3 sm:gap-4">
          <Skeleton className="h-10 w-10 shrink-0 rounded-lg sm:h-12 sm:w-12 sm:rounded-xl" />
          <div className="flex-1 min-w-0">
            <Skeleton className="h-5 w-48 mb-2 sm:h-6" />
            <div className="flex items-center gap-3">
              <Skeleton className="h-4 w-16" />
              <div className="h-1 w-1 rounded-full bg-muted-foreground/20" />
              <Skeleton className="h-4 w-24" />
            </div>
          </div>
          <div className="shrink-0 pl-2">
            <Skeleton className="h-5 w-5 rounded" />
          </div>
        </div>
      </div>
    ))}
  </div>
);
