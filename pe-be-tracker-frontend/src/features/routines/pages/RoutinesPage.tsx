import { useMemo, useState } from "react";
import { Search, ArrowLeft, Plus } from "lucide-react";
import { Link } from "react-router-dom";
import { useAppBackNavigation, useInfiniteScroll } from "@/shared/hooks";
import { getRoutines } from "@/features/routines/api";
import { RoutineStructuredData } from "@/features/routines/components/RoutineStructuredData/RoutineStructuredData";
import { RoutinesGridSkeleton } from "@/features/routines/components";
import { useStartWorkoutFromRoutine } from "@/features/routines/hooks";
import { buildRoutineCollectionJsonLd } from "@/features/routines/lib/routineStructuredData";
import type { RoutineSummary } from "@/features/routines/types";
import { RoutineQuickStartCard } from "@/features/routines/components";
import { useAuthStore } from "@/stores";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/shared/components/ui/alert";
import { cn } from "@/lib/utils";

const RoutinesPage = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const startWorkoutFromRoutine = useStartWorkoutFromRoutine();
  const [orderBy, setOrderBy] = useState<"createdAt" | "name">("createdAt");
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const handleBack = useAppBackNavigation("/workouts");

  const {
    data: routines,
    isPending,
    isFetchingNextPage,
    error,
  } = useInfiniteScroll<RoutineSummary>({
    queryKey: ["routines", orderBy, isAuthenticated ? "auth" : "guest"],
    queryFn: (cursor, limit) => getRoutines(orderBy, cursor, limit),
    limit: 100,
  });

  const filteredRoutines = useMemo(() => {
    if (!searchTerm) return routines;

    return routines.filter(
      (routine) =>
        routine.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (routine.description &&
          routine.description.toLowerCase().includes(searchTerm.toLowerCase())),
    );
  }, [routines, searchTerm]);
  const routineListJsonLd = buildRoutineCollectionJsonLd(filteredRoutines);

  if (error) {
    return (
      <div className="container mx-auto px-4 py-6">
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            Error loading routines. Please try again.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 text-center sm:p-8">
      <RoutineStructuredData data={routineListJsonLd} />

      <div className="mx-auto">
        <div className="mb-8 text-center sm:mb-10 relative">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Go back"
            type="button"
            onClick={handleBack}
            className="md:hidden absolute left-0 top-1/2 -translate-y-1/2 -ml-2 shrink-0"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-4xl font-black tracking-tight text-foreground sm:text-5xl text-glow bg-gradient-to-b from-foreground to-foreground/70 bg-clip-text text-transparent">
            Routines
          </h1>
        </div>

        {/* Search and Filter Controls */}
        <div className="mb-10 flex flex-col gap-4 lg:flex-row">
          <div className="relative flex-1 group">
            <Input
              type="text"
              placeholder="Search routines..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="border-primary/30 bg-card/90 h-16 w-full rounded-2xl pr-14 pl-14 shadow-md transition-all hover:bg-card hover:border-primary/50 focus:border-primary/60 focus:ring-8 focus:ring-primary/5 focus:shadow-2xl backdrop-blur-md font-black text-xl placeholder:font-bold placeholder:text-muted-foreground/30"
            />
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-5 z-10">
              <Search className="text-primary group-focus-within:text-primary h-6 w-6 transition-all duration-300 group-focus-within:scale-110 drop-shadow-[0_0_8px_rgba(var(--primary),0.4)]" />
            </div>
          </div>

          <div className="flex flex-row gap-2 sm:gap-4">
            <div className="flex flex-1 items-center gap-1 rounded-2xl bg-accent/50 p-1 border border-border/40 shadow-sm backdrop-blur-sm h-16 sm:w-auto sm:flex-none">
              <Button
                variant={orderBy === "createdAt" ? "default" : "ghost"}
                size="sm"
                onClick={() => setOrderBy("createdAt")}
                className={cn(
                  "flex-1 sm:flex-none rounded-xl font-bold text-[10px] uppercase tracking-wider px-3 sm:px-6 h-full transition-all",
                  orderBy === "createdAt"
                    ? "shadow-md scale-[1.02]"
                    : "opacity-60",
                )}
              >
                Recent
              </Button>
              <Button
                variant={orderBy === "name" ? "default" : "ghost"}
                size="sm"
                onClick={() => setOrderBy("name")}
                className={cn(
                  "flex-1 sm:flex-none rounded-xl font-bold text-[10px] uppercase tracking-wider px-3 sm:px-6 h-full transition-all",
                  orderBy === "name" ? "shadow-md scale-[1.02]" : "opacity-60",
                )}
              >
                A-Z
              </Button>
            </div>

            {isAuthenticated && (
              <Button
                asChild
                className="h-16 rounded-2xl px-6 font-bold bg-primary shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-all shrink-0"
              >
                <Link to="/routines/new">
                  <Plus className="mr-2 h-5 w-5" />
                  <span className="hidden sm:inline">New Routine</span>
                  <span className="sm:hidden">New</span>
                </Link>
              </Button>
            )}
          </div>
        </div>

        {/* Grid Area with Loading State */}
        <div className="min-h-[400px]">
          {isPending ? (
            <RoutinesGridSkeleton />
          ) : (
            <>
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 place-items-center sm:place-items-start">
                {filteredRoutines.map((routine) => (
                  <RoutineQuickStartCard
                    key={routine.id}
                    routine={routine}
                    onStartWorkout={startWorkoutFromRoutine}
                  />
                ))}
              </div>

              {/* Loading more indicator index scroll */}
              {isFetchingNextPage && (
                <div className="flex justify-center py-8">
                  <span className="loading loading-spinner loading-lg"></span>
                </div>
              )}

              {/* Empty State */}
              {filteredRoutines.length === 0 && (
                <div className="py-20 text-center">
                  <div className="bg-muted/30 mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full">
                    <Search className="text-muted-foreground h-10 w-10 opacity-20" />
                  </div>
                  <h3 className="text-xl font-bold text-foreground mb-2">
                    No routines found
                  </h3>
                  <p className="text-muted-foreground mb-8 max-w-xs mx-auto">
                    {searchTerm
                      ? "No routines match your current search"
                      : "No routines available"}
                  </p>
                  {searchTerm && (
                    <Button
                      onClick={() => setSearchTerm("")}
                      variant="outline"
                      className="rounded-xl border-border/40 font-bold"
                    >
                      Clear search
                    </Button>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default RoutinesPage;
