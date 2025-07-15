import { useState, useEffect, useCallback, useRef } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';

interface UseInfiniteScrollOptions<T> {
  queryKey: string[];
  queryFn: (page: number, limit: number) => Promise<T[]>;
  limit?: number;
  threshold?: number;
  enabled?: boolean;
}

export const useInfiniteScroll = <T>({
  queryKey,
  queryFn,
  limit = 20,
  threshold = 300,
  enabled = true,
}: UseInfiniteScrollOptions<T>) => {
  const [allData, setAllData] = useState<T[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const loadingRef = useRef(false);

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    error,
    refetch,
  } = useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam = 0 }) => queryFn(pageParam, limit),
    getNextPageParam: (lastPage, allPages, lastPageParam) => {
      if (lastPage.length < limit) {
        return undefined;
      }
      return lastPageParam + limit;
    },
    initialPageParam: 0,
    enabled,
  });

  // Flatten all pages into a single array
  useEffect(() => {
    if (data?.pages) {
      const flatData = data.pages.flat();
      setAllData(flatData);
      setHasMore(data.pages[data.pages.length - 1]?.length === limit);
    }
  }, [data, limit]);

  // Scroll event handler
  const handleScroll = useCallback(() => {
    if (
      !hasNextPage ||
      isFetchingNextPage ||
      loadingRef.current ||
      !enabled
    ) {
      return;
    }

    const scrollTop = document.documentElement.scrollTop || document.body.scrollTop;
    const scrollHeight = document.documentElement.scrollHeight || document.body.scrollHeight;
    const clientHeight = window.innerHeight;

    if (scrollTop + clientHeight >= scrollHeight - threshold) {
      loadingRef.current = true;
      fetchNextPage().finally(() => {
        loadingRef.current = false;
      });
    }
  }, [hasNextPage, isFetchingNextPage, threshold, fetchNextPage, enabled]);

  // Add scroll listener
  useEffect(() => {
    if (!enabled) return;

    const debouncedHandleScroll = () => {
      requestAnimationFrame(handleScroll);
    };

    window.addEventListener('scroll', debouncedHandleScroll);
    return () => window.removeEventListener('scroll', debouncedHandleScroll);
  }, [handleScroll, enabled]);

  const reset = useCallback(() => {
    setAllData([]);
    setPage(0);
    setHasMore(true);
    loadingRef.current = false;
    refetch();
  }, [refetch]);

  return {
    data: allData,
    isLoading,
    isFetchingNextPage,
    hasMore: hasNextPage,
    error,
    refetch,
    reset,
  };
};