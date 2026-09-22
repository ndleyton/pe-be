import {
  startTransition,
  useCallback,
  useDeferredValue,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type UIEvent,
} from "react";
import {
  type CreateExerciseTypeData,
  type ExerciseType,
} from "@/features/exercises/api";
import { useExerciseTypeModalResults } from "@/features/exercises/hooks/useExerciseTypeModalResults";
import { useExerciseTypeCreation } from "@/features/exercises/hooks";
import { useGuestStore, useAuthStore, GuestExerciseType } from "@/stores";
import {
  ExerciseSearchResult,
  ExerciseSearchResultSkeleton,
} from "./ExerciseSearchResult";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { EXERCISE_TYPE_MODAL_INITIAL_LIMIT } from "@/features/exercises/constants";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Input } from "@/shared/components/ui/input";
import { Search, X, Plus, Info, Dumbbell, Loader2 } from "lucide-react";

interface ExerciseTypeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (exerciseType: ExerciseType | GuestExerciseType) => void;
}

const EXERCISE_TYPE_MODAL_INITIAL_RENDER_COUNT = 30;
const EXERCISE_TYPE_MODAL_RENDER_INCREMENT = 30;
const EXERCISE_TYPE_MODAL_SCROLL_THRESHOLD = 160;
const ExerciseTypeModal = ({
  isOpen,
  onClose,
  onSelect,
}: ExerciseTypeModalProps) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [areResultsReady, setAreResultsReady] = useState(false);
  const [visibleResultCount, setVisibleResultCount] = useState(
    EXERCISE_TYPE_MODAL_INITIAL_RENDER_COUNT,
  );
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  // Get state from stores
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const guestData = useGuestStore();
  const guestActions = useGuestStore();
  const deferredSearchTerm = useDeferredValue(searchTerm);
  const trimmedSearchTerm = searchTerm.trim();

  const [selectedMuscleGroupId, setSelectedMuscleGroupId] = useState("all");
  const {
    exerciseTypes,
    filteredExerciseTypes,
    sortedMuscleGroups,
    isMuscleGroupsLoading,
    isSearchActive,
    isSearchLoading,
    isInitialBrowseLoading,
    isSearchingWithoutResults,
    isResultsPlaceholderData,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
    error,
    recordAuthenticatedSelection,
  } = useExerciseTypeModalResults({
    isOpen,
    isAuthenticated,
    deferredSearchTerm,
    selectedMuscleGroupId,
    guestExerciseTypes: guestData.exerciseTypes,
  });

  useEffect(() => {
    if (!isOpen) {
      setAreResultsReady(false);
      setVisibleResultCount(EXERCISE_TYPE_MODAL_INITIAL_RENDER_COUNT);
      setSelectedMuscleGroupId("all");
      return;
    }

    setVisibleResultCount(EXERCISE_TYPE_MODAL_INITIAL_RENDER_COUNT);
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }

    const frameId = window.requestAnimationFrame(() => {
      startTransition(() => {
        setAreResultsReady(true);
      });
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [isOpen]);

  useEffect(() => {
    if (deferredSearchTerm.trim()) {
      return;
    }

    setVisibleResultCount(EXERCISE_TYPE_MODAL_INITIAL_RENDER_COUNT);
  }, [deferredSearchTerm]);

  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
    setVisibleResultCount(EXERCISE_TYPE_MODAL_INITIAL_RENDER_COUNT);
  }, [selectedMuscleGroupId]);

  const visibleExerciseTypes =
    isAuthenticated || isSearchActive
      ? filteredExerciseTypes
      : filteredExerciseTypes.slice(0, visibleResultCount);

  const handleSelect = (exerciseType: ExerciseType | GuestExerciseType) => {
    if (isAuthenticated) {
      recordAuthenticatedSelection(exerciseType);
    } else {
      // Update guest data times_used count
      guestActions.updateExerciseType(exerciseType.id as string, {
        times_used: exerciseType.times_used + 1,
      });
    }

    setSearchTerm("");
    setSelectedMuscleGroupId("all");
    onSelect(exerciseType);
  };

  const createGuestExerciseType = useCallback(
    (payload: CreateExerciseTypeData) => {
      const newExerciseTypeId = guestActions.addExerciseType({
        name: payload.name,
        description: payload.description ?? null,
        default_intensity_unit: payload.default_intensity_unit ?? 1,
      });
      return guestData.exerciseTypes.find((exerciseType) => {
        return exerciseType.id === newExerciseTypeId;
      });
    },
    [guestActions, guestData.exerciseTypes],
  );
  const {
    showCreateButton,
    createMutation,
    handleCreateExerciseType,
  } = useExerciseTypeCreation<ExerciseType | GuestExerciseType>({
    searchTerm,
    deferredSearchTerm,
    exerciseTypes: filteredExerciseTypes,
    isSearchingWithoutResults,
    isAuthenticated,
    lookupLimit: EXERCISE_TYPE_MODAL_INITIAL_LIMIT,
    onResolvedExerciseType: handleSelect,
    createGuestExerciseType,
  });

  const handleSearchKeyDown = (e: KeyboardEvent) => {
    if (
      e.key === "Enter" &&
      !isResultsPlaceholderData &&
      filteredExerciseTypes.length > 0
    ) {
      handleSelect(filteredExerciseTypes[0]);
    } else if (e.key === "Escape") {
      setSearchTerm("");
    }
  };

  const loadMoreBrowseResults = useCallback(
    (container?: HTMLDivElement | null) => {
      if (!isOpen) {
        return;
      }

      const activeContainer = container ?? scrollContainerRef.current;
      if (!activeContainer) {
        return;
      }

      const { scrollTop, clientHeight, scrollHeight } = activeContainer;
      if (clientHeight === 0 || scrollHeight === 0) {
        return;
      }

      const isNearBottom =
        scrollTop + clientHeight >=
        scrollHeight - EXERCISE_TYPE_MODAL_SCROLL_THRESHOLD;

      if (!isNearBottom) {
        return;
      }

      if (isAuthenticated) {
        if (!hasNextPage || isFetchingNextPage) {
          return;
        }

        void fetchNextPage();
        return;
      }

      if (visibleResultCount >= filteredExerciseTypes.length) {
        return;
      }

      setVisibleResultCount((current) =>
        Math.min(
          current + EXERCISE_TYPE_MODAL_RENDER_INCREMENT,
          filteredExerciseTypes.length,
        ),
      );
    },
    [
      fetchNextPage,
      filteredExerciseTypes.length,
      hasNextPage,
      isAuthenticated,
      isFetchingNextPage,
      isOpen,
      visibleResultCount,
    ],
  );

  const handleResultsScroll = (event: UIEvent<HTMLDivElement>) => {
    loadMoreBrowseResults(event.currentTarget);
  };

  const renderContent = () => {
    if (isInitialBrowseLoading) {
      return (
        <div className="space-y-4 p-1">
          <div className="grid gap-2">
            {Array.from({ length: 6 }).map((_, index) => (
              <ExerciseSearchResultSkeleton key={index} />
            ))}
          </div>
        </div>
      );
    }

    if (isSearchingWithoutResults) {
      return (
        <div className="space-y-4 p-1">
          <div className="grid gap-2">
            {Array.from({ length: 6 }).map((_, index) => (
              <ExerciseSearchResultSkeleton key={`search-skeleton-${index}`} />
            ))}
          </div>
        </div>
      );
    }

    if (isAuthenticated && error) {
      return (
        <div className="py-12 text-center">
          <div className="bg-destructive/10 mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full">
            <span className="text-destructive text-2xl text-center">⚠</span>
          </div>
          <h4 className="text-foreground mb-2 font-bold text-lg">
            Connection Error
          </h4>
          <p className="text-muted-foreground text-sm max-w-[200px] mx-auto">
            Failed to load calculations. Please try again.
          </p>
        </div>
      );
    }

    if (!isSearchActive && exerciseTypes.length === 0) {
      return (
        <div className="py-12 text-center">
          <div className="bg-muted/50 mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full">
            <Dumbbell className="text-muted-foreground h-8 w-8" />
          </div>
          <h4 className="text-foreground mb-2 font-bold text-lg">
            {selectedMuscleGroupId !== "all"
              ? "No Exercises Found"
              : "No Exercises"}
          </h4>
          <p className="text-muted-foreground text-sm max-w-[200px] mx-auto">
            {selectedMuscleGroupId !== "all"
              ? "No exercises match the selected muscle group."
              : isAuthenticated
                ? "Your gym library is currently empty."
                : "Default exercise types will be initialized soon."}
          </p>
        </div>
      );
    }

    if (
      trimmedSearchTerm &&
      filteredExerciseTypes.length === 0 &&
      !isSearchingWithoutResults
    ) {
      return (
        <div className="py-12 text-center">
          <div className="bg-primary/5 mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full">
            <Search className="text-primary/40 h-8 w-8" />
          </div>
          <h4 className="text-foreground mb-1 font-bold text-lg">No matches</h4>
          <p className="text-muted-foreground text-sm px-4">
            Create &quot;{trimmedSearchTerm}&quot; using the button above.
          </p>
        </div>
      );
    }

    if (!areResultsReady) {
      return (
        <div className="space-y-4 p-1">
          <div className="grid gap-2">
            {Array.from({ length: 8 }).map((_, index) => (
              <ExerciseSearchResultSkeleton key={`deferred-skeleton-${index}`} />
            ))}
          </div>
        </div>
      );
    }

    return (
      <div
        className={`space-y-4 p-1 transition-opacity duration-150 ${
          isResultsPlaceholderData
            ? "opacity-60 pointer-events-none"
            : ""
        }`}
      >
        <div className="grid gap-2">
          {visibleExerciseTypes.map((exerciseType) => (
            <ExerciseSearchResult
              key={exerciseType.id}
              exerciseType={exerciseType}
              onSelect={handleSelect}
              disabled={isResultsPlaceholderData}
            />
          ))}
        </div>

        {isAuthenticated && isFetchingNextPage && (
          <div className="flex justify-center py-2">
            <span className="text-muted-foreground text-xs font-medium">
              Loading more exercises...
            </span>
          </div>
        )}
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="max-h-[85vh] sm:max-w-xl border-border/40 p-0 overflow-hidden flex flex-col"
        hideOverlay={true}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogTitle className="sr-only">Select Exercise Type</DialogTitle>
        <DialogDescription className="sr-only">
          Search existing exercise types or create a new one to add to the workout.
        </DialogDescription>

        <div className="px-4 pt-9 pb-1 sm:px-5 sm:pt-10 sm:pb-2">
          <div className="relative group">
            <Input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder="Search exercise types..."
              disabled={isAuthenticated && createMutation.isPending}
              className="border-primary/30 bg-card/90 md:h-16 h-14 w-full rounded-2xl md:pr-14 pr-12 md:pl-14 pl-12 shadow-md transition-all hover:bg-card hover:border-primary/50 focus:border-primary/60 focus:ring-8 focus:ring-primary/5 focus:shadow-xl backdrop-blur-md font-black md:text-xl text-base placeholder:font-bold placeholder:text-muted-foreground/30 disabled:opacity-50"
            />
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center md:pl-5 pl-4 z-10">
              <Search className="text-primary group-focus-within:text-primary md:h-6 md:w-6 h-5 w-5 transition-all duration-300 group-focus-within:scale-110 drop-shadow-[0_0_8px_rgba(var(--primary-rgb),0.4)]" />
            </div>

            <div className="absolute inset-y-0 right-0 flex items-center pr-2 gap-1">
              {searchTerm && !showCreateButton && (
                <div className="relative">
                  <button
                    onClick={() => setSearchTerm("")}
                    className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg transition-all"
                    title="Clear search"
                  >
                    <X className="h-5 w-5" />
                  </button>

                  {isAuthenticated && isSearchActive && isSearchLoading && (
                    <span className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-lg bg-background/20">
                      <Loader2 className="text-muted-foreground/10 h-8 w-8 animate-spin" />
                    </span>
                  )}
                </div>
              )}

              {showCreateButton && (
                <button
                  onClick={handleCreateExerciseType}
                  disabled={isAuthenticated && createMutation.isPending}
                  className="flex items-center gap-1.5 bg-primary px-3 py-1.5 rounded-xl text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
                  title={`Create "${trimmedSearchTerm}"`}
                >
                  {isAuthenticated && createMutation.isPending ? (
                    <Plus className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Plus className="h-4 w-4" />
                      Create New
                    </>
                  )}
                </button>
              )}
            </div>
          </div>

          {isAuthenticated && createMutation.isError && (
            <p className="text-destructive mt-3 text-xs font-semibold flex items-center gap-1 bg-destructive/5 p-2 rounded-lg">
              <Info className="h-3 w-3" />
              Failed to create exercise type. Please try again.
            </p>
          )}

          {/* Muscle Group Quick-Filter Chips */}
          {isAuthenticated && isMuscleGroupsLoading && sortedMuscleGroups.length === 0 ? (
            <div
              data-testid="muscle-group-filter-chips-skeleton"
              className="mt-3 flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none"
              aria-label="Loading muscle group filters"
              aria-busy="true"
            >
              <Skeleton className="h-7 w-12 shrink-0 rounded-xl" />
              <Skeleton className="h-7 w-16 shrink-0 rounded-xl" />
              <Skeleton className="h-7 w-14 shrink-0 rounded-xl" />
              <Skeleton className="h-7 w-20 shrink-0 rounded-xl" />
              <Skeleton className="h-7 w-16 shrink-0 rounded-xl" />
            </div>
          ) : sortedMuscleGroups.length > 0 ? (
            <div
              data-testid="muscle-group-filter-chips"
              className="mt-3 flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none"
              role="tablist"
              aria-label="Filter exercises by muscle group"
            >
              <button
                type="button"
                role="tab"
                aria-selected={selectedMuscleGroupId === "all"}
                onClick={() => setSelectedMuscleGroupId("all")}
                className={`shrink-0 rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
                  selectedMuscleGroupId === "all"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "border border-border/30 bg-secondary/60 text-secondary-foreground hover:bg-secondary"
                }`}
              >
                All
              </button>
              {sortedMuscleGroups.map((group) => {
                const isSelected = selectedMuscleGroupId === String(group.id);
                return (
                  <button
                    key={group.id}
                    type="button"
                    role="tab"
                    aria-selected={isSelected}
                    onClick={() =>
                      setSelectedMuscleGroupId(
                        isSelected ? "all" : String(group.id),
                      )
                    }
                    className={`shrink-0 rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
                      isSelected
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "border border-border/30 bg-secondary/60 text-secondary-foreground hover:bg-secondary"
                    }`}
                  >
                    {group.name}
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>

        <div
          ref={scrollContainerRef}
          onScroll={handleResultsScroll}
          data-testid="exercise-type-modal-scroll-container"
          className="flex-1 overflow-y-auto px-4 pb-4 scrollbar-thin scrollbar-thumb-border/20 sm:px-5 sm:pb-5"
        >
          {renderContent()}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ExerciseTypeModal;
