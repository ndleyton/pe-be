import {
  startTransition,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type UIEvent,
} from "react";
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
  type InfiniteData,
} from "@tanstack/react-query";
import {
  getExerciseTypes,
  createExerciseType,
  type ExerciseType,
} from "@/features/exercises/api";
import { useGuestStore, useAuthStore, GuestExerciseType } from "@/stores";
import axios from "axios";
import { MUSCLE_DISPLAY_LIMIT } from "@/shared/constants";
import { EXERCISE_TYPE_MODAL_INITIAL_LIMIT } from "@/features/exercises/constants";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Search, X, Plus, Info, Dumbbell, Loader2 } from "lucide-react";

interface ExerciseTypeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (exerciseType: ExerciseType | GuestExerciseType) => void;
}

const EXERCISE_TYPE_MODAL_INITIAL_RENDER_COUNT = 30;
const EXERCISE_TYPE_MODAL_RENDER_INCREMENT = 30;
const EXERCISE_TYPE_MODAL_SCROLL_THRESHOLD = 160;
const normalizeExerciseTypeName = (name: string) => name.trim().toLowerCase();
const EXERCISE_TYPE_MODAL_QUERY_KEY = [
  "exerciseTypes",
  "modal",
  "usage",
] as const;
const EXERCISE_TYPE_MODAL_SEARCH_QUERY_KEY = [
  "exerciseTypes",
  "modal",
  "search",
] as const;

type ExerciseTypePage = {
  data: ExerciseType[];
  next_cursor?: number | null;
};

// Type guard to check if an exercise type has muscles property
const hasMusclesProperty = (
  exerciseType: ExerciseType | GuestExerciseType,
): exerciseType is ExerciseType & {
  muscles: Array<{ id: number; name: string }>;
} => {
  return "muscles" in exerciseType && Array.isArray(exerciseType.muscles);
};

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
  const [lastSettledSearchResults, setLastSettledSearchResults] = useState<
    ExerciseType[]
  >([]);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const queryClient = useQueryClient();
  // Get state from stores
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const guestData = useGuestStore();
  const guestActions = useGuestStore();
  const deferredSearchTerm = useDeferredValue(searchTerm);
  const trimmedSearchTerm = searchTerm.trim();
  const trimmedDeferredSearchTerm = deferredSearchTerm.trim();
  const isSearchActive = trimmedDeferredSearchTerm.length > 0;

  const {
    data: browseExerciseTypesResponse,
    isPending: isBrowseLoading,
    hasNextPage: hasBrowseNextPage,
    fetchNextPage: fetchBrowseNextPage,
    isFetchingNextPage: isFetchingBrowseNextPage,
    error: browseError,
  } = useInfiniteQuery({
    queryKey: EXERCISE_TYPE_MODAL_QUERY_KEY,
    queryFn: ({ pageParam }) =>
      getExerciseTypes("usage", pageParam, EXERCISE_TYPE_MODAL_INITIAL_LIMIT),
    getNextPageParam: (lastPage) => lastPage?.next_cursor ?? undefined,
    initialPageParam: undefined as number | undefined,
    enabled: isAuthenticated && isOpen,
  });

  const {
    data: searchExerciseTypesResponse,
    isPending: isSearchLoading,
    hasNextPage: hasSearchNextPage,
    fetchNextPage: fetchSearchNextPage,
    isFetchingNextPage: isFetchingSearchNextPage,
    error: searchError,
  } = useInfiniteQuery({
    queryKey: [
      ...EXERCISE_TYPE_MODAL_SEARCH_QUERY_KEY,
      trimmedDeferredSearchTerm.toLowerCase(),
    ],
    queryFn: ({ pageParam }) =>
      getExerciseTypes(
        "name",
        pageParam,
        EXERCISE_TYPE_MODAL_INITIAL_LIMIT,
        undefined,
        trimmedDeferredSearchTerm,
      ),
    getNextPageParam: (lastPage) => lastPage?.next_cursor ?? undefined,
    initialPageParam: undefined as number | undefined,
    enabled: isAuthenticated && isOpen && isSearchActive,
  });

  const browseExerciseTypes = useMemo(
    () =>
      browseExerciseTypesResponse?.pages.flatMap((page) =>
        Array.isArray(page?.data) ? page.data : [],
      ) ?? [],
    [browseExerciseTypesResponse],
  );

  const searchExerciseTypes = useMemo(
    () =>
      searchExerciseTypesResponse?.pages.flatMap((page) =>
        Array.isArray(page?.data) ? page.data : [],
      ) ?? [],
    [searchExerciseTypesResponse],
  );

  useEffect(() => {
    if (!isAuthenticated || !isSearchActive) {
      setLastSettledSearchResults([]);
      return;
    }

    if (!isSearchLoading) {
      setLastSettledSearchResults(searchExerciseTypes);
    }
  }, [
    isAuthenticated,
    isSearchActive,
    isSearchLoading,
    searchExerciseTypes,
  ]);

  // Use guest data if not authenticated, server data if authenticated
  const exerciseTypes = isAuthenticated
    ? isSearchActive
      ? searchExerciseTypes.length > 0 || !isSearchLoading
        ? searchExerciseTypes
        : lastSettledSearchResults
      : browseExerciseTypes
    : Array.isArray(guestData.exerciseTypes)
      ? guestData.exerciseTypes
      : [];

  useEffect(() => {
    if (!isOpen) {
      setAreResultsReady(false);
      setVisibleResultCount(EXERCISE_TYPE_MODAL_INITIAL_RENDER_COUNT);
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

  const filteredExerciseTypes = useMemo(() => {
    if (isAuthenticated) {
      return exerciseTypes;
    }

    if (!trimmedDeferredSearchTerm) return exerciseTypes;
    const term = trimmedDeferredSearchTerm.toLowerCase();
    return exerciseTypes.filter(
      (type: ExerciseType | GuestExerciseType) =>
        type.name.toLowerCase().includes(term) ||
        (type.description && type.description.toLowerCase().includes(term)),
    );
  }, [exerciseTypes, isAuthenticated, trimmedDeferredSearchTerm]);

  const exactExerciseTypeMatch = useMemo(
    () =>
      trimmedSearchTerm
        ? filteredExerciseTypes.find(
            (type: ExerciseType | GuestExerciseType) =>
              normalizeExerciseTypeName(type.name) ===
              normalizeExerciseTypeName(trimmedSearchTerm),
          )
        : undefined,
    [filteredExerciseTypes, trimmedSearchTerm],
  );

  const createMutation = useMutation({
    mutationFn: createExerciseType,
    onSuccess: (newExerciseType) => {
      queryClient.invalidateQueries({ queryKey: ["exerciseTypes"] });
      handleSelect(newExerciseType);
    },
    onError: (err: unknown) => {
      if (
        axios.isAxiosError(err) &&
        err.response?.status === 400 &&
        typeof err.response.data?.detail === "string" &&
        err.response.data.detail.toLowerCase().includes("already exists")
      ) {
        // Backend indicates the type already exists — select it instead of showing an error
        void findExactExerciseTypeMatch(searchTerm).then((existing) => {
          if (existing) {
            handleSelect(existing);
          }
        });
        return;
      }
    },
  });

  const hasNextPage = isSearchActive ? hasSearchNextPage : hasBrowseNextPage;
  const fetchNextPage = isSearchActive
    ? fetchSearchNextPage
    : fetchBrowseNextPage;
  const isFetchingNextPage = isSearchActive
    ? isFetchingSearchNextPage
    : isFetchingBrowseNextPage;
  const isLoading = isSearchActive ? isSearchLoading : isBrowseLoading;
  const error = isSearchActive ? searchError : browseError;
  const isInitialBrowseLoading =
    isAuthenticated &&
    !isSearchActive &&
    isLoading &&
    exerciseTypes.length === 0;
  const isSearchingWithoutResults =
    isAuthenticated &&
    isSearchActive &&
    isSearchLoading &&
    lastSettledSearchResults.length === 0 &&
    searchExerciseTypes.length === 0;
  const isSearchSettled =
    trimmedSearchTerm.length === 0 ||
    (trimmedSearchTerm === trimmedDeferredSearchTerm && !isSearchLoading);
  const showCreateButton =
    trimmedSearchTerm &&
    isSearchSettled &&
    !exactExerciseTypeMatch &&
    !isSearchingWithoutResults;
  const visibleExerciseTypes =
    isAuthenticated || isSearchActive
      ? filteredExerciseTypes
      : filteredExerciseTypes.slice(0, visibleResultCount);

  const createInFlight = useRef(false);

  const findExactExerciseTypeMatch = useCallback(
    async (name: string) => {
      const normalizedName = normalizeExerciseTypeName(name);
      const existingInResults = filteredExerciseTypes.find(
        (type: ExerciseType | GuestExerciseType) =>
          normalizeExerciseTypeName(type.name) === normalizedName,
      );
      if (existingInResults) {
        return existingInResults;
      }

      if (!isAuthenticated) {
        return undefined;
      }

      const response = await getExerciseTypes(
        "name",
        undefined,
        EXERCISE_TYPE_MODAL_INITIAL_LIMIT,
        undefined,
        name,
      );
      return response.data.find(
        (type) => normalizeExerciseTypeName(type.name) === normalizedName,
      );
    },
    [filteredExerciseTypes, isAuthenticated],
  );

  const handleSelect = (exerciseType: ExerciseType | GuestExerciseType) => {
    if (isAuthenticated) {
      // Optimistically update the times_used count in the cache for server data
      queryClient.setQueryData(
        EXERCISE_TYPE_MODAL_QUERY_KEY,
        (oldData: InfiniteData<ExerciseTypePage> | undefined) => {
          if (!oldData?.pages.length) return oldData;

          const pageSizes = oldData.pages.map((page) => page.data.length);
          const updatedTypes = oldData.pages
            .flatMap((page) => page.data)
            .map((type) =>
              type.id === exerciseType.id
                ? { ...type, times_used: type.times_used + 1 }
                : type,
            );

          // Re-sort by times_used DESC, then by name ASC to maintain the expected order
          const sortedTypes = [...updatedTypes].sort((a, b) => {
            if (a.times_used !== b.times_used) {
              return b.times_used - a.times_used; // DESC
            }
            return a.name.localeCompare(b.name); // ASC
          });

          let currentOffset = 0;
          const pages = oldData.pages.map((page, index) => {
            const pageSize = pageSizes[index];
            const nextOffset = currentOffset + pageSize;
            const nextPage = {
              ...page,
              data: sortedTypes.slice(currentOffset, nextOffset),
            };
            currentOffset = nextOffset;
            return nextPage;
          });

          return {
            ...oldData,
            pages,
          };
        },
      );
    } else {
      // Update guest data times_used count
      guestActions.updateExerciseType(exerciseType.id as string, {
        times_used: exerciseType.times_used + 1,
      });
    }

    onSelect(exerciseType);
  };

  const handleCreateExerciseType = () => {
    if (createInFlight.current) return; // ignore duplicate clicks while pending
    const trimmedName = trimmedSearchTerm;
    if (!trimmedName) return;

    createInFlight.current = true;

    // Avoid creating duplicates — if a type with the same name (case-insensitive) already exists, reuse it
    const existingType = exactExerciseTypeMatch;

    if (existingType) {
      handleSelect(existingType);
      createInFlight.current = false;
      return;
    }

    // Heuristic for default intensity unit
    const cardioKeywords = ["walking", "running", "cycling", "swimming", "treadmill", "rowing", "elliptical", "jogging"];
    const isCardio = cardioKeywords.some(keyword => trimmedName.toLowerCase().includes(keyword));
    const defaultUnitId = isCardio ? 3 : 1; // 3 = km/h, 1 = kg

    if (isAuthenticated) {
      createMutation.mutate(
        {
          name: trimmedName,
          description: "Custom exercise",
          default_intensity_unit: defaultUnitId,
        },
        {
          onSettled: () => {
            createInFlight.current = false;
          },
        },
      );
    } else {
      const newExerciseTypeId = guestActions.addExerciseType({
        name: trimmedName,
        description: "Custom exercise",
        default_intensity_unit: defaultUnitId,
      });

      const newExerciseType = guestData.exerciseTypes.find(
        (et) => et.id === newExerciseTypeId,
      );
      if (newExerciseType) {
        handleSelect(newExerciseType);
        createInFlight.current = false;
      }
    }
  };

  const handleSearchKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" && filteredExerciseTypes.length > 0) {
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

  const SkeletonCard = () => (
    <div className="bg-card/40 border-border/40 animate-pulse rounded-2xl border p-4">
      <div className="flex items-center space-x-4">
        <div className="bg-muted h-12 w-12 rounded-xl"></div>
        <div className="flex-1">
          <div className="bg-muted mb-2 h-4 w-1/2 rounded"></div>
          <div className="bg-muted h-3 w-3/4 rounded"></div>
        </div>
      </div>
    </div>
  );

  const renderContent = () => {
    if (isInitialBrowseLoading) {
      return (
        <div className="grid gap-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <SkeletonCard key={index} />
          ))}
        </div>
      );
    }

    if (isSearchingWithoutResults) {
      return (
        <div className="grid gap-3 p-1">
          {Array.from({ length: 6 }).map((_, index) => (
            <SkeletonCard key={`search-skeleton-${index}`} />
          ))}
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

    if (exerciseTypes.length === 0) {
      return (
        <div className="py-12 text-center">
          <div className="bg-muted/50 mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full">
            <Dumbbell className="text-muted-foreground h-8 w-8" />
          </div>
          <h4 className="text-foreground mb-2 font-bold text-lg">
            No Exercises
          </h4>
          <p className="text-muted-foreground text-sm max-w-[200px] mx-auto">
            {isAuthenticated
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
        <div className="grid gap-3 p-1">
          {Array.from({ length: 8 }).map((_, index) => (
            <SkeletonCard key={`deferred-skeleton-${index}`} />
          ))}
        </div>
      );
    }

    return (
      <div className="space-y-4 p-1">
        <div className="grid gap-3">
          {visibleExerciseTypes.map(
            (exerciseType: ExerciseType | GuestExerciseType) => (
              <button
                key={exerciseType.id}
                onClick={() => handleSelect(exerciseType)}
                className="group relative flex w-full items-center space-x-4 overflow-hidden rounded-2xl border border-border/40 bg-card/60 p-4 text-left transition-all hover:scale-[1.01] hover:bg-accent/60 hover:border-primary/30 active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary font-bold text-xl transition-colors duration-300 group-hover:bg-primary group-hover:text-primary-foreground">
                  <span>{exerciseType.name.charAt(0)}</span>
                </div>

                <div className="flex-1 overflow-hidden">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="truncate text-foreground font-bold text-base group-hover:text-primary transition-colors">
                      {exerciseType.name}
                    </h4>
                  </div>

                  <p className="text-muted-foreground mt-0.5 line-clamp-1 text-xs font-medium leading-normal opacity-70 group-hover:opacity-100">
                    {exerciseType.description || "No description provided."}
                  </p>

                  {hasMusclesProperty(exerciseType) &&
                    exerciseType.muscles.length > 0 && (
                      <div className="mt-2.5 flex flex-wrap gap-1.5 grayscale-[0.5] group-hover:grayscale-0 transition-all">
                        {exerciseType.muscles
                          .slice(0, MUSCLE_DISPLAY_LIMIT)
                          .map((muscle) => (
                            <span
                              key={muscle.id}
                              className="inline-flex items-center rounded-lg bg-secondary/80 px-2 py-0.5 text-[10px] font-bold text-secondary-foreground border border-border/30"
                            >
                              {muscle.name}
                            </span>
                          ))}
                        {exerciseType.muscles.length > MUSCLE_DISPLAY_LIMIT && (
                          <span className="inline-flex items-center rounded-lg bg-secondary/50 px-2 py-0.5 text-[10px] font-bold text-muted-foreground border border-border/20">
                            +{exerciseType.muscles.length - MUSCLE_DISPLAY_LIMIT}
                          </span>
                        )}
                      </div>
                    )}
                </div>

                <div className="text-muted-foreground opacity-30 transition-all group-hover:translate-x-1 group-hover:opacity-100 group-hover:text-primary">
                  <Plus className="h-5 w-5" />
                </div>
              </button>
            ),
          )}
        </div>

        {isAuthenticated && isFetchingNextPage && !isSearchActive && (
          <div className="flex justify-center py-1">
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
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
              <Search className="text-muted-foreground group-focus-within:text-primary h-5 w-5 transition-colors" />
            </div>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder="Search exercise types..."
              disabled={isAuthenticated && createMutation.isPending}
              className="border-border/50 bg-accent/30 text-foreground placeholder-muted-foreground/60 focus:ring-primary/20 block w-full rounded-2xl border py-3 pr-12 pl-12 focus:border-primary/30 focus:ring-4 focus:outline-none disabled:opacity-50 transition-all font-medium"
            />

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
