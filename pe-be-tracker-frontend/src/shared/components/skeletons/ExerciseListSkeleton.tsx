import { Skeleton } from '@/shared/components/ui/skeleton';
import { DEFAULT_SKELETON_COUNT } from '@/shared/constants';

interface ExerciseListSkeletonProps {
  count?: number;
}

export const ExerciseListSkeleton = ({ count = DEFAULT_SKELETON_COUNT }: ExerciseListSkeletonProps) => (
  <div className="space-y-4">
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="bg-card rounded-lg p-4">
        <div className="flex items-center space-x-4">
          <Skeleton className="w-8 h-8 rounded" />
          <div className="flex-1">
            <Skeleton className="h-5 w-1/2 mb-2" />
            <Skeleton className="h-4 w-1/3" />
          </div>
        </div>
      </div>
    ))}
  </div>
);
