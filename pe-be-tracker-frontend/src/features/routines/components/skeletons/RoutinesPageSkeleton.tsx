import { Skeleton } from "@/shared/components/ui/skeleton";
import { Card } from "@/shared/components/ui/card";

type RoutinesPageSkeletonProps = {
  count?: number;
  variant?: "programs" | "routines";
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

const RoutineProgramCardSkeleton = () => (
  <Card className="bg-card/40 border-border/20 relative flex h-full w-full max-w-sm flex-col overflow-hidden rounded-2xl border py-4 shadow-md backdrop-blur-sm">
    <div className="px-6 pb-3">
      <div className="mb-4 flex items-start gap-3">
        <Skeleton className="h-11 w-11 rounded-xl" />
        <div className="min-w-0 flex-1">
          <Skeleton className="mb-2 h-6 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <Skeleton className="h-7 w-20 rounded-lg" />
        <Skeleton className="h-7 w-24 rounded-lg" />
        <Skeleton className="h-7 w-16 rounded-lg" />
      </div>
    </div>
    <div className="flex flex-1 flex-col gap-4 px-6 pb-3">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-11 w-full rounded-xl" />
    </div>
  </Card>
);

export const RoutinesGridSkeleton = ({
  count = 6,
  variant = "programs",
}: RoutinesPageSkeletonProps) => (
  <div
    className={
      variant === "programs"
        ? "grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3"
        : "grid grid-cols-1 gap-6 place-items-center sm:grid-cols-2 sm:place-items-start lg:grid-cols-3"
    }
  >
    {Array.from({ length: count }).map((_, index) => (
      variant === "programs" ? (
        <RoutineProgramCardSkeleton key={index} />
      ) : (
        <RoutineQuickStartCardSkeleton key={index} />
      )
    ))}
  </div>
);

export const RoutinesPageSkeleton = ({
  count = 6,
  variant = "programs",
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
      <div className="flex items-center gap-2 sm:gap-4">
        <div className="flex flex-1 items-center gap-1 rounded-2xl p-1 h-16 sm:flex-none">
          <Skeleton className="h-full w-24 sm:w-32 rounded-xl" />
          <Skeleton className="h-full w-24 sm:w-32 rounded-xl" />
        </div>
        <Skeleton className="h-16 w-[7.5rem] shrink-0 rounded-2xl shadow-lg sm:hidden" />
        <div className="hidden items-center gap-1 rounded-2xl p-1 h-16 sm:flex">
          <Skeleton className="h-full w-24 sm:w-28 rounded-xl" />
          <Skeleton className="h-full w-24 sm:w-28 rounded-xl" />
        </div>
      </div>
    </div>

    <RoutinesGridSkeleton count={count} variant={variant} />
  </div>
);
