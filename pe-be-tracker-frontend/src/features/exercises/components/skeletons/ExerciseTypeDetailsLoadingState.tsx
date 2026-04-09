import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

import { Button } from "@/shared/components/ui/button";
import { Skeleton } from "@/shared/components/ui/skeleton";

const ExerciseTypeDetailsLoadingState = () => (
  <div className="mx-auto max-w-4xl p-4 text-center md:p-6 lg:p-8">
    <div className="mb-8">
      <div className="flex items-start justify-between gap-3 text-left sm:gap-4">
        <div className="flex flex-1 items-start gap-3 sm:gap-4">
          <Button
            variant="ghost"
            size="icon"
            asChild
            aria-label="Go back"
            className="mt-1 shrink-0"
          >
            <Link to="/exercise-types">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <Skeleton className="h-8 w-full max-w-[16rem] sm:h-9 sm:max-w-[20rem]" />
            </div>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-24" />
            </div>
          </div>
        </div>

        <div className="flex shrink-0 gap-2">
          <Skeleton className="h-9 w-16 rounded-xl" />
        </div>
      </div>
    </div>

    <div className="grid grid-cols-1 gap-6 text-left lg:grid-cols-2 lg:gap-8">
      <div className="space-y-6">
        <div className="overflow-hidden">
          <div className="bg-muted/50 border-border/20 flex aspect-video items-center justify-center overflow-hidden rounded-2xl border shadow-md">
            <Skeleton className="h-full w-full rounded-none" />
          </div>
        </div>

        <div className="bg-card border-border/20 rounded-2xl border p-6 shadow-md">
          <div className="mb-4 flex flex-wrap gap-2">
            <Skeleton className="h-6 w-16 rounded-full" />
            <Skeleton className="h-6 w-20 rounded-full" />
            <Skeleton className="h-6 w-14 rounded-full" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-11/12" />
            <Skeleton className="h-4 w-4/5" />
          </div>
        </div>

        <div className="bg-card border-border/20 rounded-2xl border p-6 shadow-md">
          <Skeleton className="mb-4 h-6 w-32" />
          <Skeleton className="mb-2 h-4 w-full" />
          <Skeleton className="mb-2 h-4 w-11/12" />
          <Skeleton className="h-4 w-5/6" />
        </div>
      </div>

      <div className="space-y-6">
        <div className="bg-card border-border/20 rounded-2xl border p-6 shadow-md">
          <h2 className="mb-4 text-lg font-semibold">Progressive Overload</h2>
          <div className="flex justify-center py-4">
            <span className="loading loading-spinner loading-md"></span>
          </div>
          <Skeleton className="h-48 w-full" />
        </div>

        <div className="bg-card border-border/20 rounded-2xl border p-6 shadow-md">
          <h2 className="mb-4 text-lg font-semibold">Last Workout</h2>
          <div className="flex justify-center py-2">
            <span className="loading loading-spinner loading-sm"></span>
          </div>
          <Skeleton className="h-24 w-full" />
        </div>

        <div className="bg-card border-border/20 rounded-2xl border p-6 shadow-md">
          <h2 className="mb-4 text-lg font-semibold">Personal Best</h2>
          <div className="flex justify-center py-2">
            <span className="loading loading-spinner loading-sm"></span>
          </div>
          <Skeleton className="h-20 w-full" />
        </div>
      </div>
    </div>
  </div>
);

export default ExerciseTypeDetailsLoadingState;
