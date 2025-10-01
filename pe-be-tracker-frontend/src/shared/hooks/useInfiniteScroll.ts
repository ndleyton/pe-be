import { useEffect, useCallback, useRef, useMemo } from 'react';
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
  const loadingRef = useRef(false);

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isPending,
    isFetched,
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
    getNextPageParam: (lastPage) => lastPage?.next_cursor ?? undefined,
    initialPageParam: undefined,
    enabled,
  });

  // Flatten all pages into a single array synchronously to avoid flicker
  const flatData = useMemo<T[]>(() => {
    if (!data?.pages) return [];
    return data.pages.flatMap((page) => {
      if (!page || !page.data) return [];
      return Array.isArray(page.data) ? page.data : [];
    });
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
    loadingRef.current = false;
    refetch();
  }, [refetch]);

  return {
    data: flatData,
    // v5 naming: expose both for compatibility
    isPending,
    isFetched,
    isFetchingNextPage,
    hasMore: hasNextPage,
    error,
    refetch,
    reset,
  };
};
