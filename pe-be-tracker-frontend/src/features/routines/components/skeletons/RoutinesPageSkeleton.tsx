import { Skeleton } from "@/shared/components/ui/skeleton";
import { Card } from "@/shared/components/ui/card";

type RoutinesPageSkeletonProps = {
  count?: number;
};

const RoutineQuickStartCardSkeleton = () => (
  <Card className="bg-card/40 border-border/20 relative flex min-h-[15.5rem] sm:min-h-[17rem] h-full w-full max-w-sm flex-col overflow-hidden rounded-2xl border py-4 px-6 shadow-md backdrop-blur-sm">
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
      <Skeleton className="h-10 flex-1 rounded-xl" />
      <Skeleton className="h-10 flex-1 rounded-xl" />
    </div>
  </Card>
);

export const RoutinesGridSkeleton = ({
  count = 6,
}: RoutinesPageSkeletonProps) => (
  <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 place-items-center sm:place-items-start">
    {Array.from({ length: count }).map((_, index) => (
      <RoutineQuickStartCardSkeleton key={index} />
    ))}
  </div>
);

export const RoutinesPageSkeleton = ({
  count = 6,
}: RoutinesPageSkeletonProps) => (
  <div
    className="mx-auto max-w-5xl px-4 py-6 text-center sm:p-8"
    aria-busy="true"
    aria-live="polite"
  >
    <div className="mb-8 text-center sm:mb-10">
      <h1 className="text-4xl font-black tracking-tight text-foreground/20 sm:text-5xl">
        Routines
      </h1>
    </div>

    <div className="mb-10 flex flex-col gap-4 lg:flex-row">
      <div className="relative flex-1">
        <Skeleton className="h-16 w-full rounded-2xl shadow-md" />
      </div>
      <div className="flex flex-row gap-2 sm:gap-4">
        <div className="flex flex-1 items-center gap-1 rounded-2xl p-1 h-16 sm:w-auto sm:flex-none">
          <Skeleton className="h-full w-24 sm:w-32 rounded-xl" />
          <Skeleton className="h-full w-24 sm:w-32 rounded-xl" />
        </div>
        <Skeleton className="h-16 w-16 sm:w-32 rounded-2xl shadow-lg" />
      </div>
    </div>

    <RoutinesGridSkeleton count={count} />
  </div>
);
