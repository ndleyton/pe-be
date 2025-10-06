import React from 'react';
import { Skeleton } from '@/shared/components/ui/skeleton';

const ExerciseTypesPageSkeleton: React.FC = () => (
  <div className="max-w-5xl mx-auto p-8 text-center" aria-busy="true" aria-live="polite">
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Exercises</h1>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-8">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <div className="h-5 w-5 bg-muted rounded" />
          </div>
          <Skeleton className="h-12 w-full rounded-xl" />
        </div>
        <div className="w-full sm:w-[180px]">
          <Skeleton className="h-12 w-full rounded-xl" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="bg-card rounded-2xl p-6 shadow-md border border-border/20">
            <Skeleton className="h-6 w-3/4 mb-3" />
            <Skeleton className="h-4 w-full mb-2" />
            <Skeleton className="h-4 w-5/6 mb-4" />
            <div className="flex gap-2 mb-4">
              <Skeleton className="h-7 w-20 rounded-full" />
              <Skeleton className="h-7 w-28 rounded-full" />
            </div>
            <div className="flex justify-between">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-5 w-24" />
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

export default ExerciseTypesPageSkeleton;

