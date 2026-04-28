import { Skeleton } from "@/shared/components/ui/skeleton";

export const PublicActivityPageSkeleton = () => (
  <div
    className="mx-auto min-h-screen max-w-4xl px-4 py-6 sm:py-8 text-left"
    aria-busy="true"
    aria-live="polite"
  >
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        <Skeleton className="h-10 w-10 shrink-0 rounded-md" />
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-9 w-64 max-w-full rounded-xl" />
          <Skeleton className="h-4 w-24 rounded-full" />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Skeleton className="h-10 flex-1 sm:w-24 sm:flex-none rounded-md" />
        <Skeleton className="h-10 flex-1 sm:w-32 sm:flex-none rounded-md" />
      </div>
    </div>

    <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="rounded-lg border border-border p-3">
          <Skeleton className="mb-2 h-3 w-16 rounded-full" />
          <Skeleton className="h-6 w-20 rounded-xl" />
        </div>
      ))}
    </div>

    <section className="space-y-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="rounded-2xl border border-border/40 bg-muted/20 p-4 shadow-sm"
        >
          <div className="mb-4 flex items-start justify-between gap-4 border-b border-border/10 pb-4">
            <div className="flex min-w-0 items-start gap-4">
              <Skeleton className="h-10 w-10 sm:h-12 sm:w-12 shrink-0 rounded-xl" />
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-6 w-48 max-w-full rounded-xl" />
                <Skeleton className="mt-1.5 h-4 w-16 rounded-full" />
              </div>
            </div>
          </div>

          <div className="mt-2 space-y-2">
            {Array.from({ length: 2 }).map((_, j) => (
              <div
                key={j}
                className="flex w-full items-center gap-3 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2.5"
              >
                <Skeleton className="h-3 w-3 shrink-0 rounded-full" />
                <Skeleton className="h-4 w-32 rounded-full" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </section>
  </div>
);

export default PublicActivityPageSkeleton;
