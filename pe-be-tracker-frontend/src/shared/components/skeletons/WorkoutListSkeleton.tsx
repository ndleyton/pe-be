import { Skeleton } from "@/shared/components/ui/skeleton";
import { DEFAULT_SKELETON_COUNT } from "@/shared/constants";

interface WorkoutListSkeletonProps {
  count?: number;
}

export const WorkoutListSkeleton = ({
  count = DEFAULT_SKELETON_COUNT,
}: WorkoutListSkeletonProps) => (
  <div className="space-y-3">
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="bg-card rounded-lg p-5">
        <div className="flex items-center justify-between space-x-4">
          <div className="flex items-center space-x-4">
            <Skeleton className="h-10 w-10 flex-shrink-0 rounded-lg" />
            <div className="flex-1">
              <Skeleton className="mb-1 h-5 w-40" />
              <div className="mt-1 flex items-center gap-4">
                <Skeleton className="h-6 w-16" />
                <Skeleton className="h-4 w-24" />
              </div>
            </div>
          </div>
          <Skeleton className="h-5 w-5 flex-shrink-0 rounded" />
        </div>
      </div>
    ))}
  </div>
);
