import { Skeleton } from "@/shared/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface WeekTrackingSkeletonProps {
  className?: string;
}

export const WeekTrackingSkeleton = ({
  className = "",
}: WeekTrackingSkeletonProps) => (
  <div
    className={cn(
      "rounded-3xl bg-border p-4 shadow-md",
      className,
    )}
  >
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="space-y-1 text-left">
          <Skeleton className="h-2 w-16 rounded-full" />
          <Skeleton className="h-5 w-28 rounded-full" />
        </div>
        <Skeleton className="h-6 w-16 rounded-full" />
      </div>

      <div className="flex justify-between gap-1">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="flex flex-col items-center gap-2.5">
            <span className="text-[10px] font-bold uppercase tracking-tight text-card-foreground/60">
              {["S", "M", "T", "W", "T", "F", "S"][i]}
            </span>
            <Skeleton className="h-9 w-9 rounded-xl sm:h-11 sm:w-11 sm:rounded-2xl" />
          </div>
        ))}
      </div>
    </div>
  </div>
);
