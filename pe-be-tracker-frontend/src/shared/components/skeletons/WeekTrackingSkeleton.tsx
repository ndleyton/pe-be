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
      "relative overflow-hidden rounded-[2rem] border border-white/20 bg-white/10 p-6 shadow-2xl backdrop-blur-2xl dark:border-white/10 dark:bg-white/5",
      className,
    )}
  >
    {/* Subtle Background Glows */}
    <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <div className="absolute -right-[10%] -top-[20%] h-64 w-64 rounded-full bg-primary/10 blur-[100px]" />
      <div className="absolute -bottom-[20%] -left-[10%] h-64 w-64 rounded-full bg-primary/5 blur-[80px]" />
    </div>

    <div className="relative z-10 space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1.5">
          <Skeleton className="h-2 w-20 rounded-full bg-primary/20" />
          <Skeleton className="h-6 w-32 rounded-full bg-white/20 dark:bg-white/10" />
        </div>
        <Skeleton className="h-7 w-20 rounded-full bg-white/20 dark:bg-white/10" />
      </div>

      <div className="flex justify-between">
      {Array.from({ length: 7 }).map((_, i) => (
        <div key={i} className="flex flex-col items-center gap-3">
          <span className="text-[10px] font-black tracking-widest text-muted-foreground/30 uppercase">
            {["S", "M", "T", "W", "T", "F", "S"][i]}
          </span>
          <Skeleton className="h-12 w-12 rounded-2xl bg-white/20 dark:bg-white/10" />
        </div>
      ))}
      </div>
    </div>
  </div>
);
