import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import axios from "axios";
import { Search, Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  createExerciseType,
  getExerciseTypes,
  getMuscleGroups,
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
import { Skeleton } from "@/shared/components/ui/skeleton";
import { cn } from "@/lib/utils";

const EXERCISE_TYPES_PAGE_LIMIT = 100;
const EXERCISE_TYPES_PAGE_SCROLL_THRESHOLD = 300;
const normalizeExerciseTypeName = (name: string) => name.trim().toLowerCase();

const ExerciseTypesPage = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [orderBy, setOrderBy] = useState<"usage" | "name">("usage");
  const [selectedMuscleGroupId, setSelectedMuscleGroupId] = useState("all");
  const [lastSettledSearchResults, setLastSettledSearchResults] = useState<
    ExerciseType[]
  >([]);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const createInFlight = useRef(false);
  const infiniteScrollLoadingRef = useRef(false);
  const deferredSearchTerm = useDeferredValue(searchTerm);
  const trimmedSearchTerm = searchTerm.trim();
  const trimmedDeferredSearchTerm = deferredSearchTerm.trim();
  const normalizedSearchTerm = trimmedDeferredSearchTerm.toLowerCase();
  const normalizedEnteredSearchTerm =
    normalizeExerciseTypeName(trimmedSearchTerm);
  const isSearchActive = trimmedDeferredSearchTerm.length > 0;
  const activeMuscleGroupId =
    selectedMuscleGroupId === "all" ? undefined : Number(selectedMuscleGroupId);

  const {
    data: browseExerciseTypesResponse,
    isPending: isBrowseLoading,
    isFetchingNextPage: isFetchingBrowseNextPage,
    hasNextPage: hasBrowseNextPage,
    fetchNextPage: fetchBrowseNextPage,
    error: browseError,
  } = useInfiniteQuery({
    queryKey: [
      "exerciseTypes",
      "page",
      "browse",
      orderBy,
      activeMuscleGroupId ?? "all",
    ],
    queryFn: ({ pageParam }) =>
      getExerciseTypes(
        orderBy,
        pageParam,
        EXERCISE_TYPES_PAGE_LIMIT,
        activeMuscleGroupId,
      ),
    getNextPageParam: (lastPage) => lastPage?.next_cursor ?? undefined,
    initialPageParam: undefined as number | undefined,
    enabled: !isSearchActive,
  });

  const {
    data: searchExerciseTypesResponse,
    isPending: isSearchLoading,
    isFetchingNextPage: isFetchingSearchNextPage,
    hasNextPage: hasSearchNextPage,
    fetchNextPage: fetchSearchNextPage,
    error: searchError,
  } = useInfiniteQuery({
    queryKey: [
      "exerciseTypes",
      "page",
      "search",
      orderBy,
      activeMuscleGroupId ?? "all",
      normalizedSearchTerm,
    ],
    queryFn: ({ pageParam }) =>
      getExerciseTypes(
        orderBy,
        pageParam,
        EXERCISE_TYPES_PAGE_LIMIT,
        activeMuscleGroupId,
        trimmedDeferredSearchTerm,
      ),
    getNextPageParam: (lastPage) => lastPage?.next_cursor ?? undefined,
    initialPageParam: undefined as number | undefined,
    enabled: isSearchActive,
  });

  const { data: muscleGroups = [], isPending: isMuscleGroupsLoading } = useQuery(
    {
      queryKey: ["muscleGroups"],
      queryFn: getMuscleGroups,
    },
  );

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
    if (!isSearchActive) {
      setLastSettledSearchResults([]);
      return;
    }

    if (!isSearchLoading) {
      setLastSettledSearchResults(searchExerciseTypes);
    }
  }, [isSearchActive, isSearchLoading, searchExerciseTypes]);

  const exerciseTypes = isSearchActive
    ? searchExerciseTypes.length > 0 || !isSearchLoading
      ? searchExerciseTypes
      : lastSettledSearchResults
    : browseExerciseTypes;

  const hasMore = isSearchActive ? hasSearchNextPage : hasBrowseNextPage;
  const isFetchingNextPage = isSearchActive
    ? isFetchingSearchNextPage
    : isFetchingBrowseNextPage;
  const error = isSearchActive ? searchError : browseError;
  const isPending = isSearchActive ? isSearchLoading : isBrowseLoading;
  const isInitialLoading = isPending && exerciseTypes.length === 0;
  const fetchNextPage = isSearchActive
    ? fetchSearchNextPage
    : fetchBrowseNextPage;
  const isSearchSettled =
    trimmedSearchTerm.length === 0 ||
    (trimmedSearchTerm === trimmedDeferredSearchTerm && !isSearchLoading);
  const isSearchingWithoutResults =
    isSearchActive &&
    isSearchLoading &&
    lastSettledSearchResults.length === 0 &&
    searchExerciseTypes.length === 0;

  const loadMoreResults = useCallback(() => {
    if (!hasMore || isFetchingNextPage || infiniteScrollLoadingRef.current) {
      return;
    }

    const scrollTop =
      document.documentElement.scrollTop || document.body.scrollTop;
    const scrollHeight =
      document.documentElement.scrollHeight || document.body.scrollHeight;
    const clientHeight = window.innerHeight;

    if (
      scrollTop + clientHeight <
      scrollHeight - EXERCISE_TYPES_PAGE_SCROLL_THRESHOLD
    ) {
      return;
    }

    infiniteScrollLoadingRef.current = true;
    void fetchNextPage().finally(() => {
      infiniteScrollLoadingRef.current = false;
    });
  }, [fetchNextPage, hasMore, isFetchingNextPage]);

  useEffect(() => {
    const handleScroll = () => {
      window.requestAnimationFrame(loadMoreResults);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [loadMoreResults]);

  const sortedMuscleGroups = useMemo(
    () => [...muscleGroups].sort((a, b) => a.name.localeCompare(b.name)),
    [muscleGroups],
  );
  const exactExerciseTypeMatch = useMemo(
    () =>
      trimmedSearchTerm
        ? exerciseTypes.find(
            (exerciseType) =>
              normalizeExerciseTypeName(exerciseType.name) ===
              normalizedEnteredSearchTerm,
          )
        : undefined,
    [exerciseTypes, normalizedEnteredSearchTerm, trimmedSearchTerm],
  );
  const isMuscleGroupSelectorDisabled = isMuscleGroupsLoading;
  const hasActiveFilters =
    trimmedSearchTerm.length > 0 || selectedMuscleGroupId !== "all";
  const showCreateButton =
    isAuthenticated &&
    trimmedSearchTerm.length > 0 &&
    isSearchSettled &&
    !exactExerciseTypeMatch &&
    !isSearchingWithoutResults;

  const findExactExerciseTypeMatch = useCallback(
    async (name: string) => {
      const normalizedName = normalizeExerciseTypeName(name);
      const existingInResults = exerciseTypes.find(
        (exerciseType) =>
          normalizeExerciseTypeName(exerciseType.name) === normalizedName,
      );
      if (existingInResults) {
        return existingInResults;
      }

      const response = await getExerciseTypes(
        "name",
        undefined,
        EXERCISE_TYPES_PAGE_LIMIT,
        undefined,
        name,
      );
      return response.data.find(
        (exerciseType) =>
          normalizeExerciseTypeName(exerciseType.name) === normalizedName,
      );
    },
    [exerciseTypes],
  );

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
        void findExactExerciseTypeMatch(searchTerm).then((existing) => {
          if (existing) {
            navigate(`/exercise-types/${existing.id}`);
          }
        });
      }
    },
  });

  const handleCreateExerciseType = () => {
    if (createInFlight.current) return;

    const trimmedName = trimmedSearchTerm;
    if (!trimmedName) return;

    const existing = exactExerciseTypeMatch;
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
    <div className="mx-auto max-w-5xl px-4 py-6 text-center sm:p-8">
      <div className="mx-auto">
        <div className="mb-8 text-center sm:mb-10">
          <h1 className="text-4xl font-black tracking-tight text-foreground sm:text-5xl text-glow bg-gradient-to-b from-foreground to-foreground/70 bg-clip-text text-transparent">Exercises</h1>
        </div>

        {/* Search and Filter Controls */}
        <div className="mb-10 flex flex-col gap-4 lg:flex-row">
          <div className="relative flex-1 group">
            <Input
              type="text"
              placeholder="Search exercises..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              disabled={createMutation.isPending}
              className="border-primary/30 bg-card/90 h-16 w-full rounded-2xl pr-14 pl-14 shadow-md transition-all hover:bg-card hover:border-primary/50 focus:border-primary/60 focus:ring-8 focus:ring-primary/5 focus:shadow-2xl backdrop-blur-md font-black text-xl placeholder:font-bold placeholder:text-muted-foreground/30"
            />
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-5 z-10">
              <Search className="text-primary group-focus-within:text-primary h-6 w-6 transition-all duration-300 group-focus-within:scale-110 drop-shadow-[0_0_8px_rgba(var(--primary),0.4)]" />
            </div>
            {showCreateButton && (
              <button
                type="button"
                title={`Create "${trimmedSearchTerm}"`}
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

          <div className="flex flex-row gap-2 sm:gap-4">
            <Select
              value={selectedMuscleGroupId}
              onValueChange={setSelectedMuscleGroupId}
              disabled={isMuscleGroupSelectorDisabled}
            >
              <SelectTrigger
                aria-label="Filter by muscle group"
                className="border-border/40 bg-card/60 h-16 w-[150px] sm:w-[200px] rounded-2xl shadow-sm backdrop-blur-sm font-bold focus:ring-primary/10 transition-all"
              >
                <SelectValue
                  placeholder={
                    isMuscleGroupSelectorDisabled
                      ? "..."
                      : "Muscles"
                  }
                />
              </SelectTrigger>
              <SelectContent className="rounded-2xl border-border/40 backdrop-blur-xl">
                <SelectItem value="all">All Muscle Groups</SelectItem>
                {sortedMuscleGroups.map((muscleGroup) => (
                  <SelectItem
                    key={muscleGroup.id}
                    value={String(muscleGroup.id)}
                  >
                    {muscleGroup.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex flex-1 items-center gap-1 rounded-2xl bg-accent/50 p-1 border border-border/40 shadow-sm backdrop-blur-sm h-16 sm:w-auto sm:flex-none">
              <Button
                variant={orderBy === "usage" ? "default" : "ghost"}
                size="sm"
                onClick={() => setOrderBy("usage")}
                className={cn(
                  "flex-1 sm:flex-none rounded-xl font-bold text-[10px] uppercase tracking-wider px-3 sm:px-6 h-full transition-all",
                  orderBy === "usage" ? "shadow-md scale-[1.02]" : "opacity-60"
                )}
              >
                Popular
              </Button>
              <Button
                variant={orderBy === "name" ? "default" : "ghost"}
                size="sm"
                onClick={() => setOrderBy("name")}
                className={cn(
                  "flex-1 sm:flex-none rounded-xl font-bold text-[10px] uppercase tracking-wider px-3 sm:px-6 h-full transition-all",
                  orderBy === "name" ? "shadow-md scale-[1.02]" : "opacity-60"
                )}
              >
                A-Z
              </Button>
            </div>
          </div>
        </div>

        {/* Exercise Types Grid - Always show structure */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {isInitialLoading ? (
            <>
              {Array.from({ length: 9 }).map((_, i) => (
                <div
                  key={i}
                  className="bg-card/40 border-border/20 rounded-2xl border p-6 shadow-md backdrop-blur-sm"
                >
                  <div className="flex items-center gap-4 mb-4">
                    <Skeleton className="h-12 w-12 rounded-xl" />
                    <div className="flex-1">
                      <Skeleton className="h-6 w-3/4 mb-2" />
                      <Skeleton className="h-4 w-1/2" />
                    </div>
                  </div>
                  <Skeleton className="h-4 w-full mb-2" />
                  <Skeleton className="h-4 w-5/6 mb-6" />
                  <div className="flex flex-wrap gap-2">
                    <Skeleton className="h-7 w-20 rounded-full" />
                    <Skeleton className="h-7 w-24 rounded-full" />
                  </div>
                </div>
              ))}
            </>
          ) : (
            exerciseTypes.map((exerciseType) => (
              <ExerciseTypeCard
                key={exerciseType.id}
                exerciseType={exerciseType}
              />
            ))
          )}
        </div>

        {/* Loading more indicator */}
        {!isInitialLoading && isFetchingNextPage && (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent loading-spinner" />
          </div>
        )}

        {/* End of results indicator */}
        {!isInitialLoading && !hasMore && exerciseTypes.length > 0 && (
          <div className="py-12 text-center">
            <p className="text-muted-foreground text-sm font-medium opacity-50">
              No more exercise types to load
            </p>
          </div>
        )}

        {/* Empty State */}
        {!isInitialLoading && exerciseTypes.length === 0 && (
          <div className="py-20 text-center">
            <div className="bg-muted/30 mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full">
              <Search className="text-muted-foreground h-10 w-10 opacity-20" />
            </div>
            <h3 className="text-xl font-bold text-foreground mb-2">No exercises found</h3>
            <p className="text-muted-foreground mb-8 max-w-xs mx-auto">
              {hasActiveFilters
                ? "No exercise types match your current filters"
                : "No exercise types available"}
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
                Clear filters
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ExerciseTypesPage;
