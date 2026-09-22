import { useEffect, useMemo, useRef, useState } from "react";
import {
  keepPreviousData,
  useInfiniteQuery,
  useQuery,
  useQueryClient,
  type InfiniteData,
} from "@tanstack/react-query";
import { getExerciseTypes, getMuscleGroups, type ExerciseType, type MuscleGroup } from "@/features/exercises/api";
import type { GuestExerciseType } from "@/stores";
import { EXERCISE_TYPE_MODAL_INITIAL_LIMIT } from "@/features/exercises/constants";

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

interface ExerciseTypeModalResultsOptions {
  isOpen: boolean;
  isAuthenticated: boolean;
  deferredSearchTerm: string;
  selectedMuscleGroupId: string;
  guestExerciseTypes: GuestExerciseType[];
}

export function useExerciseTypeModalResults({
  isOpen,
  isAuthenticated,
  deferredSearchTerm,
  selectedMuscleGroupId,
  guestExerciseTypes,
}: ExerciseTypeModalResultsOptions) {
  const queryClient = useQueryClient();
  const [lastSettledSearchResults, setLastSettledSearchResults] = useState<ExerciseType[]>([]);
  const trimmedDeferredSearchTerm = deferredSearchTerm.trim();
  const isSearchActive = trimmedDeferredSearchTerm.length > 0;
  const activeMuscleGroupId =
    selectedMuscleGroupId === "all" ? undefined : Number(selectedMuscleGroupId);

  const { data: muscleGroups = [], isPending: isMuscleGroupsLoading } = useQuery<
    MuscleGroup[]
  >({
    queryKey: ["muscleGroups"],
    queryFn: getMuscleGroups,
    staleTime: Infinity,
  });

  const availableMuscleGroups: Array<{ id: number | string; name: string }> =
    useMemo(() => {
      if (muscleGroups.length > 0) {
        return muscleGroups;
      }
      const groupsMap = new Map<string, { id: number | string; name: string }>();
      if (!isAuthenticated && Array.isArray(guestExerciseTypes)) {
        guestExerciseTypes.forEach((ex) => {
          ex.muscle_groups?.forEach((mg) => {
            if (!groupsMap.has(mg.toLowerCase())) {
              groupsMap.set(mg.toLowerCase(), { id: mg, name: mg });
            }
          });
          ex.muscles?.forEach((m) => {
            if (!groupsMap.has(m.name.toLowerCase())) {
              groupsMap.set(m.name.toLowerCase(), { id: m.id, name: m.name });
            }
          });
        });
      }
      return Array.from(groupsMap.values());
    }, [guestExerciseTypes, isAuthenticated, muscleGroups]);

  const sortedMuscleGroups = useMemo(
    () => [...availableMuscleGroups].sort((a, b) => a.name.localeCompare(b.name)),
    [availableMuscleGroups],
  );

  const {
    data: browseExerciseTypesResponse,
    isPending: isBrowseLoading,
    hasNextPage: hasBrowseNextPage,
    fetchNextPage: fetchBrowseNextPage,
    isFetchingNextPage: isFetchingBrowseNextPage,
    isPlaceholderData: isBrowsePlaceholderData,
    error: browseError,
  } = useInfiniteQuery({
    queryKey: [
      ...EXERCISE_TYPE_MODAL_QUERY_KEY,
      activeMuscleGroupId ?? "all",
    ],
    queryFn: ({ pageParam }) =>
      getExerciseTypes(
        "usage",
        pageParam,
        EXERCISE_TYPE_MODAL_INITIAL_LIMIT,
        ...(activeMuscleGroupId !== undefined ? [activeMuscleGroupId] : []),
      ),
    getNextPageParam: (lastPage) => lastPage?.next_cursor ?? undefined,
    initialPageParam: undefined as number | undefined,
    enabled: isAuthenticated && isOpen,
    placeholderData: keepPreviousData,
  });

  const {
    data: searchExerciseTypesResponse,
    isPending: isSearchPending,
    isFetching: isSearchFetching,
    hasNextPage: hasSearchNextPage,
    fetchNextPage: fetchSearchNextPage,
    isFetchingNextPage: isFetchingSearchNextPage,
    isPlaceholderData: isSearchPlaceholderData,
    error: searchError,
  } = useInfiniteQuery({
    queryKey: [
      ...EXERCISE_TYPE_MODAL_SEARCH_QUERY_KEY,
      activeMuscleGroupId ?? "all",
      trimmedDeferredSearchTerm.toLowerCase(),
    ],
    queryFn: ({ pageParam }) =>
      getExerciseTypes(
        "name",
        pageParam,
        EXERCISE_TYPE_MODAL_INITIAL_LIMIT,
        activeMuscleGroupId,
        trimmedDeferredSearchTerm,
      ),
    getNextPageParam: (lastPage) => lastPage?.next_cursor ?? undefined,
    initialPageParam: undefined as number | undefined,
    enabled: isAuthenticated && isOpen && isSearchActive,
    placeholderData: keepPreviousData,
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

  const isSearchLoading = isSearchPending || isSearchFetching;
  const hasLoadedInitialBrowseRef = useRef(false);

  useEffect(() => {
    if (browseExerciseTypesResponse?.pages?.length) {
      hasLoadedInitialBrowseRef.current = true;
    }
  }, [browseExerciseTypesResponse]);

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
    : Array.isArray(guestExerciseTypes)
      ? guestExerciseTypes
      : [];

  useEffect(() => {
    if (!isOpen) {
      hasLoadedInitialBrowseRef.current = false;
    }
  }, [isOpen]);

  useEffect(() => {
    setLastSettledSearchResults([]);
  }, [selectedMuscleGroupId]);

  const filteredExerciseTypes = useMemo(() => {
    if (isAuthenticated) {
      return exerciseTypes;
    }

    let list: GuestExerciseType[] = Array.isArray(guestExerciseTypes)
      ? guestExerciseTypes
      : [];

    if (selectedMuscleGroupId !== "all") {
      const selectedGroup = availableMuscleGroups.find(
        (mg) => String(mg.id) === selectedMuscleGroupId,
      );
      const groupName = selectedGroup?.name.toLowerCase();

      if (groupName) {
        list = list.filter((type: GuestExerciseType) => {
          if (type.muscle_groups?.some((mg) => mg.toLowerCase() === groupName)) {
            return true;
          }
          if (
            "muscles" in type &&
            Array.isArray(type.muscles) &&
            type.muscles.some((m) =>
              m.name.toLowerCase().includes(groupName),
            )
          ) {
            return true;
          }
          if (type.category?.toLowerCase() === groupName) {
            return true;
          }
          if (type.name.toLowerCase().includes(groupName)) {
            return true;
          }
          if (type.description?.toLowerCase().includes(groupName)) {
            return true;
          }
          return false;
        });
      }
    }

    if (!trimmedDeferredSearchTerm) return list;
    const term = trimmedDeferredSearchTerm.toLowerCase();
    return list.filter(
      (type: GuestExerciseType) =>
        type.name.toLowerCase().includes(term) ||
        (type.description && type.description.toLowerCase().includes(term)),
    );
  }, [
    availableMuscleGroups,
    exerciseTypes,
    guestExerciseTypes,
    isAuthenticated,
    selectedMuscleGroupId,
    trimmedDeferredSearchTerm,
  ]);

  const hasNextPage = isSearchActive ? hasSearchNextPage : hasBrowseNextPage;
  const fetchNextPage = isSearchActive
    ? fetchSearchNextPage
    : fetchBrowseNextPage;
  const isFetchingNextPage = isSearchActive
    ? isFetchingSearchNextPage
    : isFetchingBrowseNextPage;
  const isResultsPlaceholderData =
    isAuthenticated &&
    (isSearchActive ? isSearchPlaceholderData : isBrowsePlaceholderData);
  const error = isSearchActive ? searchError : browseError;
  const isInitialBrowseLoading =
    isAuthenticated &&
    !isSearchActive &&
    !hasLoadedInitialBrowseRef.current &&
    isBrowseLoading &&
    exerciseTypes.length === 0;
  const isSearchingWithoutResults =
    isAuthenticated &&
    isSearchActive &&
    isSearchLoading &&
    lastSettledSearchResults.length === 0 &&
    searchExerciseTypes.length === 0;
  const recordAuthenticatedSelection = (exerciseType: ExerciseType | GuestExerciseType) => {
  // Optimistically update the times_used count in the cache for server data
  queryClient.setQueriesData(
    { queryKey: EXERCISE_TYPE_MODAL_QUERY_KEY },
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
  };

  return {
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
  };
}
