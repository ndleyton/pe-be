import { Card, CardContent } from "@/shared/components/ui/card";
import { Skeleton } from "@/shared/components/ui/skeleton";

const RoutineInfoCardSkeleton = () => (
  <Card className="bg-card/80 border-border/40 rounded-2xl border p-2 text-left shadow-xl backdrop-blur-md overflow-hidden">
    <CardContent className="grid gap-6 p-6">
      <div className="space-y-3">
        <Skeleton className="h-3 w-28 rounded-full" />
        <Skeleton className="h-8 w-full max-w-[13rem] rounded-xl" />
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
      <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 space-y-2">
          <Skeleton className="h-3 w-32 rounded-full" />
          <Skeleton className="h-6 w-full max-w-[12rem] rounded-xl" />
        </div>
        <Skeleton className="h-10 w-full max-w-[8rem] rounded-xl sm:w-32" />
      </div>

      {Array.from({ length: 2 }).map((_, index) => (
        <div
          key={index}
          className="rounded-2xl border border-border/40 bg-muted/20 p-5 shadow-sm"
        >
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 items-start gap-4">
              <Skeleton className="h-12 w-12 shrink-0 rounded-xl" />
              <div className="min-w-0 flex-1 space-y-3">
                <Skeleton className="h-6 w-full max-w-[10rem] rounded-xl" />
                <Skeleton className="h-5 w-16 rounded-full" />
                <Skeleton className="h-4 w-full max-w-[14rem] rounded-full" />
              </div>
            </div>
            <div className="flex flex-wrap gap-2 sm:justify-end">
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

export const RoutineProgramDetailsPageSkeleton = () => (
  <div className="space-y-6 text-left" aria-busy="true" aria-live="polite">
    {/* Header Skeleton */}
    <div className="mb-8 flex items-center gap-4">
      <Skeleton className="h-10 w-10 rounded-full" />
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-full max-w-[16rem] rounded-xl" />
          <Skeleton className="h-5 w-16 rounded-lg" />
        </div>
        <Skeleton className="h-3 w-28 rounded-full" />
      </div>
    </div>

    {/* Overview Section */}
    <div className="space-y-4">
      <Skeleton className="ml-1 h-3 w-24 rounded-full" />
      <Card className="overflow-hidden rounded-3xl border border-border/40 bg-card/20 shadow-xl backdrop-blur-xl">
        <CardContent className="p-0">
          <div className="flex flex-col sm:flex-row sm:items-stretch">
            <div className="min-w-0 flex-1 p-6 sm:p-8">
              <div className="space-y-3">
                <Skeleton className="h-4 w-full rounded-full" />
                <Skeleton className="h-4 w-3/4 rounded-full" />
              </div>

              <div className="mt-8 flex flex-wrap gap-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex flex-col gap-2">
                    <Skeleton className="h-2.5 w-12 rounded-full" />
                    <Skeleton className="h-7 w-10 rounded-lg" />
                  </div>
                ))}
              </div>
            </div>

            <div className="flex shrink-0 items-center justify-center border-t border-border/10 bg-primary/5 p-6 sm:w-64 sm:border-l sm:border-t-0">
              <Skeleton className="h-14 w-full rounded-2xl" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>

    {/* Schedule Section */}
    <div className="space-y-4">
      <div className="flex items-center justify-between px-1">
        <Skeleton className="h-3 w-32 rounded-full" />
        <Skeleton className="h-5 w-16 rounded-lg" />
      </div>
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="flex flex-col gap-4 rounded-2xl border border-border/40 bg-card/40 p-4 sm:flex-row"
          >
            <Skeleton className="h-12 w-12 shrink-0 rounded-xl" />
            <div className="min-w-0 flex-1 space-y-3">
              <div className="flex items-center justify-between gap-4">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <Skeleton className="h-6 w-full max-w-[12rem] rounded-xl" />
                  <Skeleton className="h-5 w-16 rounded-lg" />
                </div>
                <div className="hidden shrink-0 gap-2 sm:flex">
                  <Skeleton className="h-8 w-20 rounded-xl" />
                  <Skeleton className="h-8 w-24 rounded-xl" />
                </div>
              </div>
              <Skeleton className="h-4 w-48 rounded-full" />
              <div className="flex gap-2">
                <Skeleton className="h-6 w-20 rounded-lg" />
                <Skeleton className="h-6 w-20 rounded-lg" />
                <Skeleton className="h-6 w-20 rounded-lg" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

export const RoutineProgramDetailsLoadingState = () => (
  <div className="mx-auto min-h-screen max-w-4xl px-4 py-6 md:py-8">
    <RoutineProgramDetailsPageSkeleton />
  </div>
);

export const RoutineDetailsPageSkeleton = () => (
  <div className="space-y-8 overflow-hidden" aria-busy="true" aria-live="polite">
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
