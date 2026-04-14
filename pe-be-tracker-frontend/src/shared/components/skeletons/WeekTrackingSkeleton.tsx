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
      "relative overflow-hidden rounded-3xl border border-border/40 bg-gradient-to-br from-card/45 to-primary/[0.015] p-5 shadow-sm backdrop-blur-xl dark:from-card/35 dark:to-primary/[0.04]",
      className,
    )}
  >
    <div className="pointer-events-none absolute inset-0">
      <div className="absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-primary/18 to-transparent" />
      <div className="absolute -right-10 top-0 h-24 w-24 rounded-full bg-primary/10 blur-3xl dark:bg-primary/14" />
    </div>

    <div className="relative z-10 space-y-5">
      <div className="flex items-center justify-between">
        <div className="space-y-1.5 text-left">
          <Skeleton className="h-2 w-16 rounded-full bg-muted/40" />
          <Skeleton className="h-5 w-28 rounded-full bg-foreground/10" />
        </div>
        <Skeleton className="h-6 w-16 rounded-full bg-primary/20" />
      </div>

      <div className="flex justify-between gap-1">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="flex flex-col items-center gap-2.5">
            <span className="text-[10px] font-bold uppercase tracking-tight text-muted/30">
              {["S", "M", "T", "W", "T", "F", "S"][i]}
            </span>
            <Skeleton className="h-11 w-11 rounded-2xl bg-foreground/10" />
          </div>
        ))}
      </div>
    </div>
  </div>
);
