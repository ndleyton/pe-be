import { useMemo, useState } from "react";
import { Search, ArrowLeft } from "lucide-react";
import { useAppBackNavigation, useInfiniteScroll } from "@/shared/hooks";
import { getRoutines } from "@/features/routines/api";
import { RoutineStructuredData } from "@/features/routines/components/RoutineStructuredData/RoutineStructuredData";
import { RoutinesPageSkeleton } from "@/features/routines/components";
import { useStartWorkoutFromRoutine } from "@/features/routines/hooks";
import { buildRoutineCollectionJsonLd } from "@/features/routines/lib/routineStructuredData";
import type { Routine } from "@/features/routines/types";
import { RoutineQuickStartCard } from "@/features/routines/components";
import { useAuthStore } from "@/stores";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/shared/components/ui/alert";

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
  } = useInfiniteScroll<Routine>({
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
    <div className="mx-auto max-w-5xl px-4 py-6 md:px-6 lg:px-8">
      <RoutineStructuredData data={routineListJsonLd} />
      <div className="mb-6">
        <div className="mb-6 flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Go back"
            type="button"
            onClick={handleBack}
            className="md:hidden -ml-2"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-black tracking-tight text-glow bg-gradient-to-b from-foreground to-foreground/70 bg-clip-text text-transparent">
              Routines
            </h1>
            <p className="text-muted-foreground/70 text-xs font-bold uppercase tracking-widest mt-0.5">
              Select or search for a plan
            </p>
          </div>
        </div>
        {/* Search and Filter Controls */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row">
          <div className="relative flex-1">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <Search className="text-muted-foreground h-5 w-5" />
            </div>
            <Input
              type="text"
              placeholder="Search routines..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10"
            />
          </div>

          <Select
            value={orderBy}
            onValueChange={(value) => setOrderBy(value as "createdAt" | "name")}
          >
            <SelectTrigger className="w-full sm:w-auto">
              <SelectValue placeholder="Order By" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="createdAt">Recent</SelectItem>
              <SelectItem value="name">Alphabetical</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Loading State */}
      {isPending && <RoutinesPageSkeleton />}

      {/* Routines Grid */}
      {!isPending && (
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

          {/* Loading more indicator */}
          {isFetchingNextPage && (
            <div className="flex justify-center py-8">
              <span className="loading loading-spinner loading-lg"></span>
            </div>
          )}

        </>
      )}

      {/* Empty State */}
      {!isPending && filteredRoutines.length === 0 && (
        <div className="py-12 text-center">
          <div className="text-muted-foreground mb-4">
            {searchTerm
              ? "No routines found matching your search."
              : "No routines available."}
          </div>
          {searchTerm && (
            <Button
              onClick={() => setSearchTerm("")}
              variant="outline"
              size="sm"
            >
              Clear Search
            </Button>
          )}
        </div>
      )}
    </div>
  );
};

export default RoutinesPage;
