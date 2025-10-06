import React from 'react';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { DEFAULT_SKELETON_COUNT } from '@/shared/constants';

const ExerciseTypeDetailsPageSkeleton: React.FC = () => (
  <div className="max-w-4xl mx-auto p-4 md:p-6 lg:p-8 text-center" aria-busy="true" aria-live="polite">
    {/* Header skeleton */}
    <div className="mb-6">
      {/* Title Row */}
      <div className="flex items-center gap-3 sm:gap-4 mb-4">
        <Skeleton className="h-10 w-10 rounded shrink-0" />
        <Skeleton className="h-8 flex-1 min-w-0" />
      </div>
      {/* Muscles and Button Row */}
      <div className="flex items-center gap-3 justify-between">
        <div className="flex flex-wrap gap-2 flex-1 min-w-0">
          <Skeleton className="h-6 w-20 rounded-full" />
          <Skeleton className="h-6 w-24 rounded-full" />
          <Skeleton className="h-6 w-16 rounded-full" />
        </div>
        <Skeleton className="h-9 w-28 rounded shrink-0" />
      </div>
    </div>

    <div className="flex justify-center py-4" role="status">
      <span className="loading loading-spinner loading-lg"></span>
    </div>

    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8 text-left">
      <div className="space-y-6">
        <div className="bg-muted/50 rounded-2xl shadow-md border border-border/20 h-64"></div>
        <div className="bg-card rounded-2xl p-6 shadow-md border border-border/20">
          <Skeleton className="h-4 w-full mb-2" />
          <Skeleton className="h-4 w-5/6 mb-2" />
          <Skeleton className="h-4 w-4/5" />
        </div>
      </div>
      <div className="space-y-6">
        {Array.from({ length: DEFAULT_SKELETON_COUNT }).map((_, i) => (
          <div key={i} className="bg-card rounded-2xl p-6 shadow-md border border-border/20">
            <Skeleton className="h-6 w-56 mb-4" />
            <Skeleton className="h-40 w-full" />
          </div>
        ))}
      </div>
    </div>
  </div>
);

export default ExerciseTypeDetailsPageSkeleton;
