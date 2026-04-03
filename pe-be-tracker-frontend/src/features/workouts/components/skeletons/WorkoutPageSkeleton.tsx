import { LoadingThrobber } from "@/shared/components/ui/LoadingThrobber";

const WorkoutPageSkeleton = () => (
  <div className="mx-auto max-w-4xl px-4 py-6 md:py-8 text-center min-h-screen">
    {/* Header Skeleton */}
    <div className="mb-8 flex items-center gap-4 text-left">
      <div className="h-10 w-10 animate-pulse rounded-full bg-primary/5" />
      <div className="h-10 w-48 animate-pulse rounded-xl bg-card/40" />
    </div>

    {/* Content Area - Matches WorkoutPage space-y-6 shell */}
    <div className="space-y-6">
      <LoadingThrobber />
    </div>
  </div>
);

export default WorkoutPageSkeleton;
