import { Card, CardContent, CardHeader } from "@/shared/components/ui/card";
import { Skeleton } from "@/shared/components/ui/skeleton";

type RoutinesPageSkeletonProps = {
  count?: number;
};

const RoutineQuickStartCardSkeleton = () => (
  <Card className="bg-card/60 border-border/40 relative flex w-full max-w-sm flex-col overflow-hidden rounded-2xl border shadow-xl backdrop-blur-md">
    <CardHeader className="pb-3">
      <div className="flex items-center space-x-3">
        <Skeleton className="h-10 w-10 rounded-xl" />
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-5 w-full max-w-[11rem]" />
          <Skeleton className="h-3 w-full max-w-[8rem]" />
        </div>
      </div>
    </CardHeader>
    <CardContent className="pb-6 pt-0">
      <div className="mb-5 space-y-2">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-11/12" />
        <Skeleton className="h-3 w-3/4" />
      </div>
      <div className="mt-auto flex gap-3">
        <Skeleton className="h-10 flex-1 rounded-xl" />
        <Skeleton className="h-10 flex-1 rounded-xl" />
      </div>
    </CardContent>
  </Card>
);

const RoutinesPageSkeleton = ({
  count = 6,
}: RoutinesPageSkeletonProps) => (
  <div
    className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 place-items-center sm:place-items-start"
    aria-busy="true"
    aria-live="polite"
  >
    {Array.from({ length: count }).map((_, index) => (
      <RoutineQuickStartCardSkeleton key={index} />
    ))}
  </div>
);

export default RoutinesPageSkeleton;
