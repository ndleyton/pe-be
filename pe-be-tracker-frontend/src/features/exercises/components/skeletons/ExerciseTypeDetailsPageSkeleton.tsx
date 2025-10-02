import React from 'react';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { DEFAULT_SKELETON_COUNT } from '@/shared/constants';

const ExerciseTypeDetailsPageSkeleton: React.FC = () => (
  <div className="max-w-5xl mx-auto p-8 text-center" aria-busy="true" aria-live="polite">
    <div className="flex items-center gap-4 mb-6">
      <Skeleton className="h-10 w-10 rounded" />
      <div className="flex-1 min-w-0">
        <Skeleton className="h-8 w-full max-w-[16rem]" />
      </div>
      <div className="ml-auto">
        <Skeleton className="h-9 w-28 sm:w-36 md:w-48 rounded" />
      </div>
    </div>

    <div className="flex justify-center py-4" role="status">
      <span className="loading loading-spinner loading-lg"></span>
    </div>

    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-2 text-left">
      <div className="space-y-6">
        <div className="bg-card rounded-lg p-6 border border-border">
          <Skeleton className="h-64 w-full rounded-lg" />
        </div>
        <div className="bg-card rounded-lg p-6 border border-border">
          <Skeleton className="h-6 w-40 mb-4" />
          <Skeleton className="h-4 w-full mb-2" />
          <Skeleton className="h-4 w-5/6" />
        </div>
        <div className="bg-card rounded-lg p-6 border border-border">
          <Skeleton className="h-6 w-48 mb-4" />
          <div className="flex gap-2 flex-wrap">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-6 w-24 rounded-full" />
            ))}
          </div>
        </div>
      </div>
      <div className="space-y-6">
        {Array.from({ length: DEFAULT_SKELETON_COUNT }).map((_, i) => (
          <div key={i} className="bg-card rounded-lg p-6 border border-border">
            <Skeleton className="h-6 w-56 mb-4" />
            <Skeleton className="h-40 w-full" />
          </div>
        ))}
      </div>
    </div>
  </div>
);

export default ExerciseTypeDetailsPageSkeleton;
