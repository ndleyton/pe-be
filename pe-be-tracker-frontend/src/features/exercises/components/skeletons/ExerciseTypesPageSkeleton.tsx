import React from "react";
import { Skeleton } from "@/shared/components/ui/skeleton";

const ExerciseTypesPageSkeleton: React.FC = () => (
  <div
    className="mx-auto max-w-5xl px-4 py-6 text-center sm:p-8"
    aria-busy="true"
    aria-live="polite"
  >
    <div className="mx-auto">
      <div className="mb-8 text-center sm:mb-10">
        <h1 className="text-4xl font-black tracking-tight text-foreground/20 sm:text-5xl">
          Exercises
        </h1>
      </div>

      <div className="mb-10 flex flex-col gap-4 lg:flex-row">
        <div className="relative flex-1">
          <Skeleton className="h-16 w-full rounded-2xl" />
        </div>
        <div className="flex flex-row gap-2 sm:gap-4">
          <Skeleton className="h-16 w-[150px] sm:w-[200px] rounded-2xl" />
          <Skeleton className="h-16 flex-1 sm:w-[150px] sm:flex-none rounded-2xl" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 9 }).map((_, i) => (
          <div
            key={i}
            className="bg-card/40 border-border/20 rounded-2xl border p-6 shadow-md backdrop-blur-sm"
          >
            <div className="flex items-center gap-4 mb-4">
              <Skeleton className="h-12 w-12 rounded-xl" />
              <div className="flex-1">
                <Skeleton className="h-6 w-3/4 mb-2" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            </div>
            <Skeleton className="h-4 w-full mb-2" />
            <Skeleton className="h-4 w-5/6 mb-6" />
            <div className="flex flex-wrap gap-2">
              <Skeleton className="h-7 w-20 rounded-full" />
              <Skeleton className="h-7 w-24 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

export default ExerciseTypesPageSkeleton;
