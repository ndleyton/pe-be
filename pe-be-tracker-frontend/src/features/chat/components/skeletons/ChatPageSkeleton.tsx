import { LoadingStatus } from "@/shared/components/ui/loading-status";
import { Skeleton } from "@/shared/components/ui/skeleton";

const ChatPageSkeleton = () => (
  <div
    className="bg-background flex h-[calc(100vh-8rem)] flex-col md:h-[calc(100vh-4rem)]"
    aria-busy="true"
  >
    <LoadingStatus message="Loading chat" />

    <div
      className="border-border/20 bg-card shrink-0 border-b px-4 py-3"
      aria-hidden="true"
    >
      <div className="mx-auto flex max-w-4xl items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-9 rounded-full" />
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-44" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-9 rounded-xl" />
          <Skeleton className="h-9 w-24 rounded-xl" />
        </div>
      </div>
    </div>

    <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4" aria-hidden="true">
      <div className="mx-auto max-w-4xl px-4 py-8 text-center">
        <Skeleton className="mx-auto mb-4 h-16 w-16 rounded-full" />
        <Skeleton className="mx-auto mb-2 h-6 w-48" />
        <Skeleton className="mx-auto mb-6 h-4 w-72 max-w-full" />
        <div className="mx-auto max-w-md space-y-2">
          <Skeleton className="h-12 w-full rounded-2xl" />
          <Skeleton className="h-12 w-full rounded-2xl" />
          <Skeleton className="h-12 w-full rounded-2xl" />
        </div>
      </div>
    </div>

    <div
      className="border-border/20 bg-card shrink-0 border-t p-3 shadow-sm"
      aria-hidden="true"
    >
      <div className="mx-auto flex max-w-4xl gap-2">
        <Skeleton className="h-11 w-11 shrink-0 rounded-xl" />
        <Skeleton className="h-11 flex-1 rounded-xl" />
        <Skeleton className="h-11 w-11 shrink-0 rounded-xl" />
      </div>
    </div>
  </div>
);

export default ChatPageSkeleton;
