import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";

import {
  getExerciseTypes,
  getMuscleGroups,
  type ExerciseType,
} from "@/features/exercises/api";

const EXERCISE_TYPES_PAGE_LIMIT = 100;
const EXERCISE_TYPES_PAGE_SCROLL_THRESHOLD = 300;

type UseExerciseTypesPaginationArgs = {
  orderBy: "usage" | "name";
  activeMuscleGroupId?: number;
  normalizedSearchTerm: string;
  trimmedDeferredSearchTerm: string;
  isSearchActive: boolean;
};

export const useExerciseTypesPagination = ({
  orderBy,
  activeMuscleGroupId,
  normalizedSearchTerm,
  trimmedDeferredSearchTerm,
  isSearchActive,
}: UseExerciseTypesPaginationArgs) => {
  const [lastSettledSearchResults, setLastSettledSearchResults] = useState<
    ExerciseType[]
  >([]);
  const infiniteScrollLoadingRef = useRef(false);

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

  const {
    data: muscleGroups = [],
    isPending: isMuscleGroupsLoading,
  } = useQuery({
    queryKey: ["muscleGroups"],
    queryFn: getMuscleGroups,
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

  return {
    exerciseTypes,
    muscleGroups,
    isMuscleGroupsLoading,
    isInitialLoading,
    isPending,
    hasMore,
    isFetchingNextPage,
    fetchNextPage,
    error,
    isSearchingWithoutResults,
  };
};
