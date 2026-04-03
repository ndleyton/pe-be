
import { Skeleton } from "@/shared/components/ui/skeleton";
import { WeekTrackingSkeleton } from "@/shared/components/skeletons/WeekTrackingSkeleton";

const ProfilePageSkeleton = () => (
  <div className="mx-auto max-w-5xl px-4 py-6 text-center sm:p-8" aria-busy="true" aria-live="polite">
    <div className="mx-auto max-w-4xl">
      <div className="mb-8 text-center sm:mb-10">
        <h1 className="text-4xl font-black tracking-tight text-foreground/20 sm:text-5xl">Profile</h1>
      </div>

      <WeekTrackingSkeleton className="mb-8" />

      <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-card/40 border-border/20 rounded-2xl border p-6 shadow-sm backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <div className="text-left flex-1 min-w-0 pr-4">
                <Skeleton className="mb-2 h-3 w-20" />
                <Skeleton className="h-9 w-14" />
              </div>
              <Skeleton className="h-14 w-14 rounded-2xl" />
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-3xl border border-border/20 bg-card/40 p-8 shadow-sm backdrop-blur-md">
        <div className="flex justify-center mb-8">
          <Skeleton className="h-6 w-48" />
        </div>

        <div className="mx-auto max-w-sm space-y-8">
          <div className="flex items-center justify-between">
            <div className="text-left">
              <Skeleton className="mb-2 h-3 w-16" />
              <Skeleton className="h-6 w-32" />
            </div>
            <Skeleton className="h-3 w-3 rounded-full" />
          </div>

          <div className="flex items-center justify-between">
            <div className="text-left">
              <Skeleton className="mb-3 h-3 w-20" />
              <Skeleton className="h-10 w-32 rounded-xl" />
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
);

export default ProfilePageSkeleton;
