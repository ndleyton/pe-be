import { Card, CardContent } from "@/shared/components/ui/card";
import { Skeleton } from "@/shared/components/ui/skeleton";

const RoutineInfoCardSkeleton = () => (
  <Card className="bg-card/80 border-border/40 rounded-2xl border p-2 text-left shadow-xl backdrop-blur-md overflow-hidden">
    <CardContent className="grid gap-6 p-6">
      <div className="space-y-3">
        <Skeleton className="h-3 w-28 rounded-full" />
        <Skeleton className="h-8 w-52 rounded-xl" />
        <Skeleton className="h-4 w-full rounded-full" />
        <Skeleton className="h-4 w-3/4 rounded-full" />
      </div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Skeleton className="h-14 flex-1 rounded-xl" />
        <Skeleton className="h-14 flex-1 rounded-xl" />
        <Skeleton className="h-14 flex-1 rounded-xl" />
      </div>
    </CardContent>
  </Card>
);

const RoutineTemplatesCardSkeleton = () => (
  <Card className="bg-card/80 border-border/40 rounded-2xl border p-2 text-left shadow-xl backdrop-blur-md overflow-hidden">
    <CardContent className="space-y-6 p-6">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-3 w-32 rounded-full" />
          <Skeleton className="h-6 w-48 rounded-xl" />
        </div>
        <Skeleton className="h-10 w-32 rounded-xl" />
      </div>

      {Array.from({ length: 2 }).map((_, index) => (
        <div
          key={index}
          className="rounded-2xl border border-border/40 bg-muted/20 p-5 shadow-sm"
        >
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-4">
              <Skeleton className="h-12 w-12 rounded-xl" />
              <div className="space-y-3">
                <Skeleton className="h-6 w-40 rounded-xl" />
                <Skeleton className="h-5 w-16 rounded-full" />
                <Skeleton className="h-4 w-56 rounded-full" />
              </div>
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-9 w-20 rounded-xl" />
              <Skeleton className="h-9 w-20 rounded-xl" />
            </div>
          </div>

          <div className="space-y-3">
            {Array.from({ length: 2 }).map((_, setIndex) => (
              <div
                key={setIndex}
                className="rounded-xl border border-border/30 bg-background/50 p-4 shadow-sm backdrop-blur-sm"
              >
                <div className="mb-4 flex items-center justify-between gap-3 border-b border-border/10 pb-3">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-6 w-6 rounded-full" />
                    <Skeleton className="h-4 w-24 rounded-full" />
                  </div>
                  <Skeleton className="h-8 w-20 rounded-lg" />
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <Skeleton className="h-10 w-full rounded-xl" />
                  <Skeleton className="h-10 w-full rounded-xl" />
                  <Skeleton className="h-10 w-full rounded-xl" />
                </div>
              </div>
            ))}
          </div>

          <Skeleton className="mt-4 h-10 w-full rounded-xl" />
        </div>
      ))}
    </CardContent>
  </Card>
);

const RoutineDetailsPageSkeleton = () => (
  <div className="space-y-8" aria-busy="true" aria-live="polite">
    <RoutineInfoCardSkeleton />

    <div className="relative">
      <div className="absolute inset-0 flex items-center" aria-hidden="true">
        <div className="w-full border-t border-border/40"></div>
      </div>
      <div className="relative flex justify-center text-xs font-bold uppercase tracking-widest">
        <span className="bg-background px-4 text-muted-foreground/40">
          Exercise Sequence
        </span>
      </div>
    </div>

    <RoutineTemplatesCardSkeleton />
  </div>
);

export default RoutineDetailsPageSkeleton;
