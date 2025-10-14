
import { Skeleton } from "@/shared/components/ui/skeleton";
import { WeekTrackingSkeleton } from "@/shared/components/skeletons/WeekTrackingSkeleton";

const ProfilePageSkeleton = () => (
  <div className="mx-auto max-w-5xl p-8 text-center">
    <div className="mx-auto max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Profile</h1>
        <p className="text-muted-foreground mt-1">Track your fitness journey</p>
      </div>

      <WeekTrackingSkeleton className="mb-6" />

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-card rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <Skeleton className="mb-2 h-4 w-24" />
                <Skeleton className="h-8 w-12" />
              </div>
              <Skeleton className="h-12 w-12 rounded-full" />
            </div>
          </div>
        ))}
      </div>

      <div className="bg-card rounded-lg p-6 text-center">
        <h2 className="mb-4 text-lg font-semibold">Account Information</h2>
        <div className="flex flex-col items-center space-y-4">
          <div>
            <Skeleton className="mb-1 h-4 w-12" />
            <Skeleton className="h-5 w-20" />
          </div>
          <div>
            <Skeleton className="mb-1 h-4 w-16" />
            <Skeleton className="h-10 w-32" />
          </div>
        </div>
      </div>

      <div className="flex justify-center py-4">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    </div>
  </div>
);

export default ProfilePageSkeleton;
