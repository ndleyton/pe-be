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
      "relative overflow-hidden rounded-3xl border border-white/45 bg-gradient-to-br from-white/70 via-white/35 to-primary/8 p-4 shadow-[0_20px_55px_-28px_rgba(204,0,51,0.35)] backdrop-blur-xl dark:border-white/10 dark:from-white/10 dark:via-white/[0.07] dark:to-primary/15",
      className,
    )}
  >
    <div className="pointer-events-none absolute inset-0">
      <div className="absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-white/90 to-transparent dark:via-white/30" />
      <div className="absolute -right-10 -top-12 h-28 w-28 rounded-full bg-primary/12 blur-3xl dark:bg-primary/15" />
      <div className="absolute -bottom-16 left-0 h-28 w-28 rounded-full bg-warning/10 blur-3xl dark:bg-warning/10" />
    </div>

    <div className="relative z-10">
      <div className="flex items-start justify-between gap-3">
        <div className="text-left">
          <Skeleton className="mb-2 h-2.5 w-20 rounded-full bg-white/50 dark:bg-white/10" />
          <Skeleton className="h-6 w-28 rounded-full bg-white/55 dark:bg-white/10" />
        </div>
        <Skeleton className="h-7 w-20 rounded-full bg-white/55 dark:bg-white/10" />
      </div>

      <div className="mt-4 grid grid-cols-7 gap-2 sm:gap-3">
      {Array.from({ length: 7 }).map((_, i) => (
        <div key={i} className="flex flex-col items-center gap-2">
          <span className="text-card-foreground/60 text-xs">
            {["S", "M", "T", "W", "T", "F", "S"][i]}
          </span>
          <Skeleton className="h-11 w-11 rounded-2xl bg-white/55 dark:bg-white/10" />
          <Skeleton className="h-1.5 w-1.5 rounded-full bg-white/45 dark:bg-white/10" />
        </div>
      ))}
      </div>
    </div>
  </div>
);
