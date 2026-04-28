import { Skeleton } from "@/shared/components/ui/skeleton";

export const PublicProfilePageSkeleton = () => (
  <div
    className="mx-auto min-h-screen max-w-4xl px-4 py-8 text-left"
    aria-busy="true"
    aria-live="polite"
  >
    <header className="mb-8 border-b border-border pb-6">
      <div className="flex items-start gap-4">
        <Skeleton className="h-16 w-16 rounded-lg shrink-0" />
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-9 w-48 rounded-xl" />
          <Skeleton className="h-4 w-24 rounded-full" />
          <div className="mt-3 space-y-2">
            <Skeleton className="h-4 w-full max-w-2xl rounded-full" />
            <Skeleton className="h-4 w-3/4 max-w-2xl rounded-full" />
          </div>
        </div>
      </div>
    </header>

    <section className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
      {Array.from({ length: 2 }).map((_, i) => (
        <div key={i} className="rounded-lg border border-border p-4">
          <div className="flex items-center gap-3">
            <Skeleton className="h-5 w-5 rounded-md" />
            <div className="space-y-1.5">
              <Skeleton className="h-6 w-16 rounded-xl" />
              <Skeleton className="h-3 w-20 rounded-full" />
            </div>
          </div>
        </div>
      ))}
    </section>

    <section>
      <Skeleton className="mb-4 h-7 w-40 rounded-xl" />
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-border p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 space-y-2">
                <Skeleton className="h-5 w-32 rounded-xl" />
                <Skeleton className="h-4 w-24 rounded-full" />
                <div className="mt-2">
                  <Skeleton className="h-4 w-full max-w-md rounded-full" />
                </div>
              </div>
              <Skeleton className="h-5 w-16 shrink-0 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </section>
  </div>
);

export default PublicProfilePageSkeleton;
