import { useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { Search } from "lucide-react";
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
    <div className="mx-auto max-w-5xl p-8 text-center">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold">Exercises</h1>
        </div>

        {/* Search and Filter Controls */}
        <div className="mb-8 flex flex-col gap-3 lg:flex-row">
          <div className="relative flex-1">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
              <Search className="text-muted-foreground h-5 w-5" />
            </div>
            <Input
              type="text"
              placeholder="Search exercises..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              disabled={createMutation.isPending}
              className="border-border/30 bg-card h-12 w-full rounded-xl pr-12 pl-11 shadow-sm transition-all focus:shadow-md"
            />
            {showCreateButton ? (
              <button
                type="button"
                onClick={handleCreateExerciseType}
                disabled={createMutation.isPending}
                className="text-secondary hover:text-secondary/80 absolute inset-y-0 right-0 flex items-center pr-4 disabled:cursor-not-allowed disabled:opacity-50"
                title={`Create "${searchTerm.trim()}"`}
              >
                {createMutation.isPending ? (
                  <svg
                    className="h-5 w-5 animate-spin"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                ) : (
                  <svg
                    className="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                    />
                  </svg>
                )}
              </button>
            ) : null}
          </div>

          <Select
            value={selectedMuscleGroupId}
            onValueChange={setSelectedMuscleGroupId}
            disabled={isMuscleGroupSelectorDisabled}
          >
            <SelectTrigger
              aria-label="Filter by muscle group"
              className="border-border/30 bg-card h-12 w-full rounded-xl shadow-sm sm:w-[220px]"
            >
              <SelectValue
                placeholder={
                  isMuscleGroupSelectorDisabled
                    ? "Loading muscle groups..."
                    : "All muscle groups"
                }
              />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All muscle groups</SelectItem>
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

          <Select
            value={orderBy}
            onValueChange={(value) => setOrderBy(value as "usage" | "name")}
          >
            <SelectTrigger
              aria-label="Order exercise types"
              className="border-border/30 bg-card h-12 w-full rounded-xl shadow-sm sm:w-[180px]"
            >
              <SelectValue placeholder="Order By" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="usage">Most Used</SelectItem>
              <SelectItem value="name">Alphabetical</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Exercise Types Grid - Always show structure */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {isPending ? (
            <>
              {Array.from({ length: 9 }).map((_, i) => (
                <div
                  key={i}
                  className="bg-card border-border/20 rounded-2xl border p-6 shadow-md"
                >
                  <Skeleton className="mb-3 h-6 w-3/4" />
                  <Skeleton className="mb-2 h-4 w-full" />
                  <Skeleton className="mb-4 h-4 w-5/6" />
                  <div className="mb-4 flex gap-2">
                    <Skeleton className="h-7 w-20 rounded-full" />
                    <Skeleton className="h-7 w-28 rounded-full" />
                  </div>
                  <div className="flex justify-between">
                    <Skeleton className="h-5 w-24" />
                    <Skeleton className="h-5 w-24" />
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
          <div className="flex justify-center py-8">
            <span className="loading loading-spinner loading-lg"></span>
          </div>
        )}

        {/* End of results indicator */}
        {!isPending && !hasMore && filteredExerciseTypes.length > 0 && (
          <div className="py-8 text-center">
            <span className="text-muted-foreground text-sm">
              No more exercise types to load
            </span>
          </div>
        )}

        {/* Empty State */}
        {!isPending && filteredExerciseTypes.length === 0 && (
          <div className="py-12 text-center">
            <div className="text-muted-foreground mb-4">
              {hasActiveFilters
                ? "No exercise types match your current filters."
                : "No exercise types available."}
            </div>
            {hasActiveFilters && (
              <Button
                onClick={() => {
                  setSearchTerm("");
                  setSelectedMuscleGroupId("all");
                }}
                variant="outline"
                size="sm"
              >
                Clear Filters
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ExerciseTypesPage;
