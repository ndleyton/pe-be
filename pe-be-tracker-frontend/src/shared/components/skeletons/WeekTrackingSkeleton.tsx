import { Skeleton } from '@/shared/components/ui/skeleton';

interface WeekTrackingSkeletonProps {
  className?: string;
}

export const WeekTrackingSkeleton = ({ className = '' }: WeekTrackingSkeletonProps) => (
  <div className={`bg-border rounded-3xl p-4 shadow-md ${className}`}>
    <div className="flex justify-between items-center gap-1">
      {Array.from({ length: 7 }).map((_, i) => (
        <div key={i} className="flex flex-col items-center gap-1">
          <span className="text-xs text-card-foreground/60">
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'][i]}
          </span>
          <Skeleton className="w-8 h-8 rounded-full" />
        </div>
      ))}
    </div>
  </div>
);
