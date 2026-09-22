import { cn } from "@/lib/utils";
import { Card } from "@/shared/components/ui/card";
import { Skeleton } from "@/shared/components/ui/skeleton";

export const RoutineQuickStartCardSkeleton = ({
  className,
}: {
  className?: string;
} = {}) => (
  <Card
    className={cn(
      "bg-card/40 border-border/20 relative flex min-h-[15.5rem] sm:min-h-[17rem] h-full w-full max-w-sm flex-col overflow-hidden rounded-2xl border py-4 px-6 shadow-md backdrop-blur-sm",
      className,
    )}
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
      <Skeleton className="h-10 flex-1 rounded-xl" />
      <Skeleton className="h-10 flex-1 rounded-xl" />
    </div>
  </Card>
);
