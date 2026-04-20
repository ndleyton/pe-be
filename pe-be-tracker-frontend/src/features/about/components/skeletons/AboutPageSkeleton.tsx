import { Skeleton } from "@/shared/components/ui/skeleton";
import { Card } from "@/shared/components/ui/card";

export const AboutPageSkeleton = () => (
  <div
    className="mx-auto max-w-5xl px-4 py-12 text-center sm:p-8"
    aria-busy="true"
    aria-live="polite"
  >
    <div className="mb-12 text-center sm:mb-16">
      <Skeleton className="mx-auto h-10 w-48 sm:h-14 sm:w-80 rounded-xl" />
      <Skeleton className="mx-auto mt-6 h-4 w-40" />
    </div>

    <div className="mx-auto max-w-3xl space-y-12">
      {/* App Info Skeleton (Now First) */}
      <Card className="bg-card/40 border-border/20 overflow-hidden rounded-3xl border p-8 shadow-md backdrop-blur-sm">
        <div className="space-y-6 text-left">
          <div className="flex items-center justify-between gap-4 mb-2">
            <Skeleton className="h-9 w-48" />
            <Skeleton className="h-10 w-24 rounded-xl" />
          </div>
          <div className="flex items-center gap-2 mb-6">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-1 w-1 rounded-full" />
            <Skeleton className="h-4 w-32" />
          </div>
          <div className="space-y-3">
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-2/3" />
          </div>
          <div className="mt-8">
            <Skeleton className="h-4 w-24 mb-3 ml-1" />
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-6 w-20 rounded-lg" />
              ))}
            </div>
          </div>
        </div>
      </Card>

      {/* Bio Card Skeleton (Now Second) */}
      <Card className="bg-card/40 border-border/20 overflow-hidden rounded-3xl border p-8 shadow-2xl backdrop-blur-sm transition-all">
        <div className="flex flex-col items-center gap-8 sm:flex-row sm:items-start text-left">
          <Skeleton className="h-28 w-28 rounded-2xl shrink-0" />
          <div className="w-full space-y-6">
            <div className="space-y-3 text-center sm:text-left">
              <Skeleton className="h-9 w-56 sm:mx-0 mx-auto" />
              <div className="flex justify-center sm:justify-start">
                <Skeleton className="h-6 w-32 rounded-full" />
              </div>
            </div>
            <div className="space-y-3">
              <Skeleton className="h-5 w-full italic" />
              <div className="mt-6 flex flex-wrap justify-center sm:justify-start gap-4">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-24" />
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Get In Touch Skeleton (Now Third) */}
      <div className="space-y-6">
        <div className="text-left px-2">
           <Skeleton className="h-8 w-40 mb-2" />
           <Skeleton className="h-4 w-64" />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="bg-card/40 border-border/20 rounded-3xl border p-8 shadow-sm backdrop-blur-md">
              <div className="flex flex-col items-center gap-4">
                <Skeleton className="h-14 w-14 rounded-2xl" />
                <div className="space-y-2 w-full text-center">
                  <Skeleton className="h-6 w-20 mx-auto" />
                  <Skeleton className="h-3 w-28 mx-auto" />
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  </div>
);

export default AboutPageSkeleton;
