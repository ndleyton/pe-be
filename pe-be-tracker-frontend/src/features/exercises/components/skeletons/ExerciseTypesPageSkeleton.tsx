import React from 'react';
import { Skeleton } from '@/shared/components/ui/skeleton';

const ExerciseTypesPageSkeleton: React.FC = () => (
  <div className="max-w-5xl mx-auto p-8 text-center" aria-busy="true" aria-live="polite">
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Exercises</h1>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <div className="h-5 w-5 bg-muted rounded" />
          </div>
          <Skeleton className="h-10 w-full rounded-md" />
        </div>
        <div className="w-full sm:w-auto">
          <Skeleton className="h-10 w-full rounded-md" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="bg-card rounded-lg p-4 border border-border">
            <div className="flex items-start gap-4">
              <Skeleton className="h-12 w-12 rounded" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-5 w-2/3" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <Skeleton className="h-7 w-20 rounded-full" />
              <Skeleton className="h-7 w-28 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

export default ExerciseTypesPageSkeleton;

