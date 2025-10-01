import { Skeleton } from '@/shared/components/ui/skeleton';
import { DEFAULT_SKELETON_COUNT } from '@/shared/constants';

interface WorkoutListSkeletonProps {
  count?: number;
}

export const WorkoutListSkeleton = ({ count = DEFAULT_SKELETON_COUNT }: WorkoutListSkeletonProps) => (
  <div className="space-y-3">
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="bg-card rounded-lg p-4">
        <div className="flex items-center space-x-4">
          <Skeleton className="w-10 h-10 rounded-lg" />
          <div className="flex-1">
            <Skeleton className="h-5 w-2/5 mb-2" />
            <div className="flex items-center gap-4">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-4 w-32" />
            </div>
          </div>
          <Skeleton className="w-5 h-5 rounded" />
        </div>
      </div>
    ))}
  </div>
);
