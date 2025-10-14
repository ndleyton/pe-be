import React from "react";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { DEFAULT_SKELETON_COUNT } from "@/shared/constants";

const ExerciseTypeDetailsPageSkeleton: React.FC = () => (
  <div
    className="mx-auto max-w-4xl p-4 text-center md:p-6 lg:p-8"
    aria-busy="true"
    aria-live="polite"
  >
    {/* Header skeleton */}
    <div className="mb-6">
      {/* Title Row */}
      <div className="mb-4 flex items-center gap-3 sm:gap-4">
        <Skeleton className="h-10 w-10 shrink-0 rounded" />
        <Skeleton className="h-8 min-w-0 flex-1" />
      </div>
      {/* Muscles and Button Row */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 flex-wrap gap-2">
          <Skeleton className="h-6 w-20 rounded-full" />
          <Skeleton className="h-6 w-24 rounded-full" />
          <Skeleton className="h-6 w-16 rounded-full" />
        </div>
        <Skeleton className="h-9 w-28 shrink-0 rounded" />
      </div>
    </div>

    <div className="flex justify-center py-4" role="status">
      <span className="loading loading-spinner loading-lg"></span>
    </div>

    <div className="grid grid-cols-1 gap-6 text-left lg:grid-cols-2 lg:gap-8">
      <div className="space-y-6">
        <div className="bg-muted/50 border-border/20 h-64 rounded-2xl border shadow-md"></div>
        <div className="bg-card border-border/20 rounded-2xl border p-6 shadow-md">
          <Skeleton className="mb-2 h-4 w-full" />
          <Skeleton className="mb-2 h-4 w-5/6" />
          <Skeleton className="h-4 w-4/5" />
        </div>
      </div>
      <div className="space-y-6">
        {Array.from({ length: DEFAULT_SKELETON_COUNT }).map((_, i) => (
          <div
            key={i}
            className="bg-card border-border/20 rounded-2xl border p-6 shadow-md"
          >
            <Skeleton className="mb-4 h-6 w-56" />
            <Skeleton className="h-40 w-full" />
          </div>
        ))}
      </div>
    </div>
  </div>
);

export default ExerciseTypeDetailsPageSkeleton;
