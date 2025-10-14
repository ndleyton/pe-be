import { Skeleton } from "@/shared/components/ui/skeleton";

interface WeekTrackingSkeletonProps {
  className?: string;
}

export const WeekTrackingSkeleton = ({
  className = "",
}: WeekTrackingSkeletonProps) => (
  <div className={`bg-border rounded-3xl p-4 shadow-md ${className}`}>
    <div className="flex items-center justify-between gap-1">
      {Array.from({ length: 7 }).map((_, i) => (
        <div key={i} className="flex flex-col items-center gap-1">
          <span className="text-card-foreground/60 text-xs">
            {["S", "M", "T", "W", "T", "F", "S"][i]}
          </span>
          <Skeleton className="h-8 w-8 rounded-full" />
        </div>
      ))}
    </div>
  </div>
);
