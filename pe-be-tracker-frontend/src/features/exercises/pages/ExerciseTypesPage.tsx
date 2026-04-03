import { useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { Search, Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  createExerciseType,
  getExerciseTypes,
  type ExerciseType,
} from "@/features/exercises/api";
import { ExerciseTypeCard } from "@/features/exercises/components";
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
import { useInfiniteScroll } from "@/shared/hooks";
import { Skeleton } from "@/shared/components/ui/skeleton";

const ExerciseTypesPage = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [orderBy, setOrderBy] = useState<"usage" | "name">("usage");
  const [selectedMuscleGroupId, setSelectedMuscleGroupId] = useState("all");
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const createInFlight = useRef(false);
  const activeMuscleGroupId =
    selectedMuscleGroupId === "all" ? undefined : Number(selectedMuscleGroupId);

  const {
    data: exerciseTypes,
    isPending,
    isFetchingNextPage,
    hasMore,
    error,
  } = useInfiniteScroll<ExerciseType>({
    queryKey: ["exerciseTypes", orderBy, selectedMuscleGroupId],
    queryFn: (cursor, limit) =>
      getExerciseTypes(orderBy, cursor, limit, activeMuscleGroupId),
    limit: 100,
  });

  const filteredExerciseTypes = useMemo(() => {
    if (!searchTerm) return exerciseTypes;

    return exerciseTypes.filter(
      (exerciseType) =>
        exerciseType.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (exerciseType.description &&
          exerciseType.description
            .toLowerCase()
            .includes(searchTerm.toLowerCase())),
    );
  }, [exerciseTypes, searchTerm]);
  const fallbackMuscleGroups = useMemo(() => {
    const groupsById = new Map<number, { id: number; name: string }>();

    exerciseTypes.forEach((exerciseType) => {
      exerciseType.muscles?.forEach((muscle) => {
        groupsById.set(muscle.muscle_group.id, {
          id: muscle.muscle_group.id,
          name: muscle.muscle_group.name,
        });
      });
    });

    return Array.from(groupsById.values()).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
  }, [exerciseTypes]);
  const isMuscleGroupSelectorDisabled =
    isPending && fallbackMuscleGroups.length === 0;
  const hasActiveFilters =
    searchTerm.trim().length > 0 || selectedMuscleGroupId !== "all";
  const showCreateButton =
    isAuthenticated &&
    searchTerm.trim().length > 0 &&
    filteredExerciseTypes.length === 0;

  const createMutation = useMutation({
    mutationFn: createExerciseType,
    onSuccess: (newExerciseType) => {
      queryClient.invalidateQueries({ queryKey: ["exerciseTypes"] });
      navigate(`/exercise-types/${newExerciseType.id}`);
    },
    onError: (err: unknown) => {
      if (
        axios.isAxiosError(err) &&
        err.response?.status === 400 &&
        typeof err.response.data?.detail === "string" &&
        err.response.data.detail.toLowerCase().includes("already exists")
      ) {
        const existing = exerciseTypes.find(
          (exerciseType) =>
            exerciseType.name.toLowerCase() === searchTerm.trim().toLowerCase(),
        );
        if (existing) {
          navigate(`/exercise-types/${existing.id}`);
        }
      }
    },
  });

  const handleCreateExerciseType = () => {
    if (createInFlight.current) return;

    const trimmedName = searchTerm.trim();
    if (!trimmedName) return;

    const existing = exerciseTypes.find(
      (exerciseType) =>
        exerciseType.name.toLowerCase() === trimmedName.toLowerCase(),
    );
    if (existing) {
      navigate(`/exercise-types/${existing.id}`);
      return;
    }

    createInFlight.current = true;

    const cardioKeywords = [
      "walking",
      "running",
      "cycling",
      "swimming",
      "treadmill",
      "rowing",
      "elliptical",
      "jogging",
    ];
    const isCardio = cardioKeywords.some((keyword) =>
      trimmedName.toLowerCase().includes(keyword),
    );

    createMutation.mutate(
      {
        name: trimmedName,
        description: "Custom exercise",
        default_intensity_unit: isCardio ? 3 : 1,
      },
      {
        onSettled: () => {
          createInFlight.current = false;
        },
      },
    );
  };

  if (error) {
    return (
      <div className="container mx-auto px-4 py-6">
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            Error loading exercise types. Please try again.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl p-8">
      <div className="mx-auto">
        <div className="mb-10 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Exercises</h1>
            <p className="text-muted-foreground mt-1 text-sm font-medium">
              Manage and explore your exercise movements
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-2xl bg-accent/50 p-1 border border-border/40">
            <Button
              variant={orderBy === "usage" ? "default" : "ghost"}
              size="sm"
              onClick={() => setOrderBy("usage")}
              className="rounded-xl font-bold text-xs"
            >
              Popular
            </Button>
            <Button
              variant={orderBy === "name" ? "default" : "ghost"}
              size="sm"
              onClick={() => setOrderBy("name")}
              className="rounded-xl font-bold text-xs"
            >
              A-Z
            </Button>
          </div>
        </div>

        {/* Search and Filter Controls */}
        <div className="mb-10 flex flex-col gap-4 lg:flex-row">
          <div className="relative flex-1 group">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
              <Search className="text-muted-foreground group-focus-within:text-primary h-5 w-5 transition-colors" />
            </div>
            <Input
              type="text"
              placeholder="Search by name or description..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              disabled={createMutation.isPending}
              className="border-border/40 bg-card/60 h-14 w-full rounded-2xl pr-14 pl-12 shadow-sm transition-all focus:border-primary/30 focus:ring-4 focus:ring-primary/10 backdrop-blur-sm font-medium"
            />
            {showCreateButton && (
              <button
                type="button"
                onClick={handleCreateExerciseType}
                disabled={createMutation.isPending}
                className="absolute inset-y-0 right-2 flex items-center pr-2"
              >
                <div className="flex items-center gap-1.5 bg-primary px-3 py-2 rounded-xl text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-all shadow-lg active:scale-95">
                  {createMutation.isPending ? (
                    <Plus className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Plus className="h-4 w-4" />
                      Create
                    </>
                  )}
                </div>
              </button>
            )}
          </div>

          <div className="flex gap-4">
            <Select
              value={selectedMuscleGroupId}
              onValueChange={setSelectedMuscleGroupId}
              disabled={isMuscleGroupSelectorDisabled}
            >
              <SelectTrigger
                aria-label="Filter by muscle group"
                className="border-border/40 bg-card/60 h-14 w-full rounded-2xl shadow-sm sm:w-[220px] backdrop-blur-sm font-medium focus:ring-primary/10"
              >
                <SelectValue
                  placeholder={
                    isMuscleGroupSelectorDisabled
                      ? "Loading..."
                      : "Filter Muscles"
                  }
                />
              </SelectTrigger>
              <SelectContent className="rounded-2xl border-border/40 backdrop-blur-xl">
                <SelectItem value="all">All Muscle Groups</SelectItem>
                {fallbackMuscleGroups.map((muscleGroup) => (
                  <SelectItem
                    key={muscleGroup.id}
                    value={String(muscleGroup.id)}
                  >
                    {muscleGroup.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Exercise Types Grid - Always show structure */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {isPending ? (
            <>
              {Array.from({ length: 9 }).map((_, i) => (
                <div
                  key={i}
                  className="bg-card/40 border-border/30 rounded-2xl border p-6 animate-pulse"
                >
                  <div className="flex items-center gap-3 mb-4">
                    <Skeleton className="h-12 w-12 rounded-xl" />
                    <Skeleton className="h-6 flex-1 rounded-lg" />
                  </div>
                  <Skeleton className="mb-2 h-4 w-full rounded-md" />
                  <Skeleton className="mb-6 h-4 w-2/3 rounded-md" />
                  <div className="flex gap-2">
                    <Skeleton className="h-6 w-16 rounded-lg" />
                    <Skeleton className="h-6 w-16 rounded-lg" />
                  </div>
                </div>
              ))}
            </>
          ) : (
            filteredExerciseTypes.map((exerciseType) => (
              <ExerciseTypeCard
                key={exerciseType.id}
                exerciseType={exerciseType}
              />
            ))
          )}
        </div>

        {/* Loading more indicator */}
        {!isPending && isFetchingNextPage && (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        )}

        {/* End of results indicator */}
        {!isPending && !hasMore && filteredExerciseTypes.length > 0 && (
          <div className="py-12 text-center">
            <p className="text-muted-foreground text-sm font-medium opacity-50">
              You&apos;ve reached the end of the library
            </p>
          </div>
        )}

        {/* Empty State */}
        {!isPending && filteredExerciseTypes.length === 0 && (
          <div className="py-20 text-center">
            <div className="bg-muted/30 mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full">
              <Search className="text-muted-foreground h-10 w-10 opacity-20" />
            </div>
            <h3 className="text-xl font-bold text-foreground mb-2">No exercises found</h3>
            <p className="text-muted-foreground mb-8 max-w-xs mx-auto">
              {hasActiveFilters
                ? "We couldn't find anything matching your current filters."
                : "Your exercise collection is currently empty."}
            </p>
            {hasActiveFilters && (
              <Button
                onClick={() => {
                  setSearchTerm("");
                  setSelectedMuscleGroupId("all");
                }}
                variant="outline"
                className="rounded-xl border-border/40 font-bold"
              >
                Clear all filters
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ExerciseTypesPage;
