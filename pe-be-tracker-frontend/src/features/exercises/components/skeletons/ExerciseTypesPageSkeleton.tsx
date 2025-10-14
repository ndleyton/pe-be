import React from "react";
import { Skeleton } from "@/shared/components/ui/skeleton";

const ExerciseTypesPageSkeleton: React.FC = () => (
  <div
    className="mx-auto max-w-5xl p-8 text-center"
    aria-busy="true"
    aria-live="polite"
  >
    <div className="mx-auto max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Exercises</h1>
      </div>

      <div className="mb-8 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
            <div className="bg-muted h-5 w-5 rounded" />
          </div>
          <Skeleton className="h-12 w-full rounded-xl" />
        </div>
        <div className="w-full sm:w-[180px]">
          <Skeleton className="h-12 w-full rounded-xl" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 9 }).map((_, i) => (
          <div
            key={i}
            className="bg-card border-border/20 rounded-2xl border p-6 shadow-md"
          >
            <Skeleton className="mb-3 h-6 w-3/4" />
            <Skeleton className="mb-2 h-4 w-full" />
            <Skeleton className="mb-4 h-4 w-5/6" />
            <div className="mb-4 flex gap-2">
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
