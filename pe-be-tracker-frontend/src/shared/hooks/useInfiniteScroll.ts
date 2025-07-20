import { useState, useEffect, useCallback, useRef } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';

// Generic shape for cursor-based paginated responses
interface CursorResponse<T> {
  data: T[];
  next_cursor?: number | null;
}

interface UseInfiniteScrollOptions<T> {
  queryKey: string[];
  /**
   * Fetch function that takes an optional cursor and limit, and returns
   * the API response with `data` array and optional `next_cursor`.
   */
  queryFn: (cursor?: number | null, limit?: number) => Promise<CursorResponse<T>>;
  limit?: number;
  threshold?: number;
  enabled?: boolean;
}

export const useInfiniteScroll = <T>({
  queryKey,
  queryFn,
  limit = 100,
  threshold = 300,
  enabled = true,
}: UseInfiniteScrollOptions<T>) => {
  const [allData, setAllData] = useState<T[]>([]);
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
    queryFn: async ({ pageParam }: { pageParam?: number }) => {
      try {
        const result = await queryFn(pageParam, limit);
        return result;
      } catch (err) {
        // Surface the error to React Query so calling components can handle it
        // (e.g. show a session-expired message or retry prompt).
        throw err;
      }
    },
    getNextPageParam: (lastPage) => lastPage.next_cursor ?? undefined,
    initialPageParam: undefined,
    enabled,
  });

  // Flatten all pages into a single array
  useEffect(() => {
    if (data?.pages) {
      const flatData = data.pages.flatMap((page) => {
        if (!page || !page.data) return [];
        // Defensive check to ensure page.data is actually an array
        return Array.isArray(page.data) ? page.data : [];
      });
      setAllData(flatData);
    } else {
      // Ensure we always have an array
      setAllData([]);
    }
  }, [data]);

  // Scroll event handler
  const handleScroll = useCallback(() => {
    if (!hasNextPage || isFetchingNextPage || loadingRef.current || !enabled) {
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