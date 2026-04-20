import { Skeleton } from "@/shared/components/ui/skeleton";
import { Card } from "@/shared/components/ui/card";

export const AboutPageSkeleton = () => (
  <div
    className="mx-auto max-w-5xl px-4 py-6 text-center sm:p-8"
    aria-busy="true"
    aria-live="polite"
  >
    <div className="mb-8 text-center sm:mb-10">
      <Skeleton className="mx-auto h-12 w-48 sm:h-14 sm:w-64 rounded-xl" />
      <Skeleton className="mx-auto mt-4 h-4 w-32" />
    </div>

    <div className="mx-auto max-w-3xl space-y-8">
      {/* Bio Card Skeleton */}
      <Card className="bg-card/40 border-border/20 overflow-hidden rounded-2xl border p-6 shadow-md backdrop-blur-sm">
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start text-left">
          <Skeleton className="h-24 w-24 rounded-2xl shrink-0" />
          <div className="w-full space-y-4">
            <div className="space-y-2 text-center sm:text-left">
              <Skeleton className="h-8 w-48 sm:mx-0 mx-auto" />
              <Skeleton className="h-4 w-32 sm:mx-0 mx-auto" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
            </div>
          </div>
        </div>
      </Card>

      {/* Get In Touch Skeleton */}
      <div className="space-y-4">
        <div className="text-left px-2">
           <Skeleton className="h-6 w-32 mb-2" />
           <Skeleton className="h-4 w-56" />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="bg-card/40 border-border/20 rounded-2xl border p-6 shadow-sm backdrop-blur-md">
              <div className="flex flex-col items-center gap-4">
                <Skeleton className="h-12 w-12 rounded-full" />
                <div className="space-y-2 w-full text-center">
                  <Skeleton className="h-4 w-16 mx-auto" />
                  <Skeleton className="h-3 w-24 mx-auto" />
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* About App Skeleton */}
      <Card className="bg-card/40 border-border/20 overflow-hidden rounded-2xl border p-6 shadow-md backdrop-blur-sm">
        <div className="space-y-4 text-left">
          <Skeleton className="h-6 w-40" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        </div>
      </Card>
    </div>
  </div>
);

export default AboutPageSkeleton;
