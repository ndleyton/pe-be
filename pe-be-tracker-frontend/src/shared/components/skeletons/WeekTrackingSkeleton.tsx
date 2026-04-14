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
      "relative overflow-hidden rounded-3xl border border-border/50 bg-card/40 p-5 shadow-xl backdrop-blur-xl dark:bg-card/20",
      className,
    )}
  >
    <div className="relative z-10 space-y-5">
      <div className="flex items-center justify-between">
        <div className="space-y-0.5 text-left">
          <Skeleton className="h-2 w-16 rounded-full bg-muted/40" />
          <Skeleton className="h-5 w-28 rounded-full bg-foreground/10" />
          <div className="relative mt-1 h-1 w-8 dark:h-0.5">
            <div className="absolute inset-0 rounded-full bg-orange-400/30 blur-[4px] dark:bg-warning/20 dark:blur-[3px]" />
            <Skeleton className="relative h-1 w-8 rounded-full bg-orange-400/60 dark:h-0.5 dark:bg-warning/35" />
          </div>
        </div>
        <Skeleton className="h-6 w-16 rounded-full bg-primary/20 backdrop-blur-sm" />
      </div>

      <div className="flex justify-between gap-0.5">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="flex flex-col items-center gap-2">
            <span className="text-[10px] font-bold tracking-tight text-muted/30 uppercase">
              {["S", "M", "T", "W", "T", "F", "S"][i]}
            </span>
            <Skeleton className="h-9 w-9 rounded-xl bg-foreground/10 sm:h-11 sm:w-11 sm:rounded-2xl" />
          </div>
        ))}
      </div>
    </div>
  </div>
);
