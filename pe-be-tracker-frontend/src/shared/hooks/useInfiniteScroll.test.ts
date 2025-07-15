import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { useInfiniteScroll } from './useInfiniteScroll';

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  });

const wrapper = ({ children }: { children: React.ReactNode }) => {
  const queryClient = createTestQueryClient();
  return React.createElement(QueryClientProvider, { client: queryClient }, children);
};

// Mock scroll functions
const mockScrollTo = vi.fn();
const mockScrollHeight = 1000;
const mockClientHeight = 800;
const mockScrollTop = 0;

Object.defineProperty(window, 'scrollTo', {
  value: mockScrollTo,
  writable: true,
});

Object.defineProperty(document.documentElement, 'scrollHeight', {
  value: mockScrollHeight,
  configurable: true,
});

Object.defineProperty(window, 'innerHeight', {
  value: mockClientHeight,
  configurable: true,
});

Object.defineProperty(document.documentElement, 'scrollTop', {
  value: mockScrollTop,
  configurable: true,
});

describe('useInfiniteScroll', () => {
  let mockQueryFn: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockQueryFn = vi.fn();
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Clean up event listeners
    window.removeEventListener('scroll', expect.any(Function));
  });

  it('should initialize with empty data and loading state', () => {
    mockQueryFn.mockResolvedValue([]);

    const { result } = renderHook(
      () =>
        useInfiniteScroll({
          queryKey: ['test'],
          queryFn: mockQueryFn,
          limit: 10,
        }),
      { wrapper }
    );

    expect(result.current.data).toEqual([]);
    expect(result.current.isLoading).toBe(true);
    expect(result.current.hasMore).toBe(false); // Initially false until we have data
    expect(result.current.isFetchingNextPage).toBe(false);
  });

  it('should call queryFn with correct parameters', async () => {
    const mockData = [{ id: 1, name: 'Item 1' }];
    mockQueryFn.mockResolvedValue(mockData);

    renderHook(
      () =>
        useInfiniteScroll({
          queryKey: ['test'],
          queryFn: mockQueryFn,
          limit: 10,
        }),
      { wrapper }
    );

    await waitFor(() => {
      expect(mockQueryFn).toHaveBeenCalledWith(0, 10);
    });
  });

  it('should flatten and return data from multiple pages', async () => {
    const page1 = [{ id: 1, name: 'Item 1' }, { id: 2, name: 'Item 2' }];
    const page2 = [{ id: 3, name: 'Item 3' }, { id: 4, name: 'Item 4' }];

    mockQueryFn
      .mockResolvedValueOnce(page1)
      .mockResolvedValueOnce(page2);

    const { result } = renderHook(
      () =>
        useInfiniteScroll({
          queryKey: ['test'],
          queryFn: mockQueryFn,
          limit: 2,
        }),
      { wrapper }
    );

    await waitFor(() => {
      expect(result.current.data).toEqual(page1);
    });

    // Simulate scroll to trigger next page
    Object.defineProperty(document.documentElement, 'scrollTop', {
      value: 700,
      configurable: true,
    });

    const scrollEvent = new Event('scroll');
    window.dispatchEvent(scrollEvent);

    await waitFor(() => {
      expect(result.current.data).toEqual([...page1, ...page2]);
    });
  });

  it('should set hasMore to false when returned data is less than limit', async () => {
    const incompleteData = [{ id: 1, name: 'Item 1' }]; // Less than limit of 10
    mockQueryFn.mockResolvedValue(incompleteData);

    const { result } = renderHook(
      () =>
        useInfiniteScroll({
          queryKey: ['test'],
          queryFn: mockQueryFn,
          limit: 10,
        }),
      { wrapper }
    );

    await waitFor(() => {
      expect(result.current.hasMore).toBe(false);
    });
  });

  it('should set hasMore to true when returned data equals limit', async () => {
    const fullData = Array.from({ length: 10 }, (_, i) => ({ id: i + 1, name: `Item ${i + 1}` }));
    mockQueryFn.mockResolvedValue(fullData);

    const { result } = renderHook(
      () =>
        useInfiniteScroll({
          queryKey: ['test'],
          queryFn: mockQueryFn,
          limit: 10,
        }),
      { wrapper }
    );

    await waitFor(() => {
      expect(result.current.hasMore).toBe(true);
    });
  });

  it('should not trigger scroll when disabled', async () => {
    mockQueryFn.mockResolvedValue([]);

    renderHook(
      () =>
        useInfiniteScroll({
          queryKey: ['test'],
          queryFn: mockQueryFn,
          limit: 10,
          enabled: false,
        }),
      { wrapper }
    );

    // Simulate scroll
    Object.defineProperty(document.documentElement, 'scrollTop', {
      value: 900,
      configurable: true,
    });

    const scrollEvent = new Event('scroll');
    window.dispatchEvent(scrollEvent);

    // Should not call queryFn when disabled
    expect(mockQueryFn).not.toHaveBeenCalled();
  });

  it('should trigger loading more when scrolled near bottom', async () => {
    const page1 = [{ id: 1, name: 'Item 1' }];
    const page2 = [{ id: 2, name: 'Item 2' }];

    mockQueryFn
      .mockResolvedValueOnce(page1)
      .mockResolvedValueOnce(page2);

    const { result } = renderHook(
      () =>
        useInfiniteScroll({
          queryKey: ['test'],
          queryFn: mockQueryFn,
          limit: 1,
          threshold: 200,
        }),
      { wrapper }
    );

    await waitFor(() => {
      expect(result.current.data).toEqual(page1);
    });

    // Simulate scroll near bottom (within threshold)
    Object.defineProperty(document.documentElement, 'scrollTop', {
      value: 600, // scrollTop + clientHeight (800) = 1400, scrollHeight (1000) - threshold (200) = 800
      configurable: true,
    });

    const scrollEvent = new Event('scroll');
    window.dispatchEvent(scrollEvent);

    await waitFor(() => {
      expect(mockQueryFn).toHaveBeenCalledTimes(2);
      expect(mockQueryFn).toHaveBeenNthCalledWith(2, 1, 1);
    });
  });

  it('should reset data and refetch when reset is called', async () => {
    const initialData = [{ id: 1, name: 'Item 1' }];
    const resetData = [{ id: 2, name: 'Item 2' }];

    mockQueryFn
      .mockResolvedValueOnce(initialData)
      .mockResolvedValueOnce(resetData);

    const { result } = renderHook(
      () =>
        useInfiniteScroll({
          queryKey: ['test'],
          queryFn: mockQueryFn,
          limit: 10,
        }),
      { wrapper }
    );

    await waitFor(() => {
      expect(result.current.data).toEqual(initialData);
    });

    // Call reset
    result.current.reset();

    await waitFor(() => {
      expect(result.current.data).toEqual(resetData);
    });
  });

  it('should handle errors gracefully', async () => {
    const error = new Error('API Error');
    mockQueryFn.mockRejectedValue(error);

    const { result } = renderHook(
      () =>
        useInfiniteScroll({
          queryKey: ['test'],
          queryFn: mockQueryFn,
          limit: 10,
        }),
      { wrapper }
    );

    await waitFor(() => {
      expect(result.current.error).toBeDefined();
      expect(result.current.data).toEqual([]);
    });
  });

  it('should use custom limit when provided', async () => {
    mockQueryFn.mockResolvedValue([]);

    renderHook(
      () =>
        useInfiniteScroll({
          queryKey: ['test'],
          queryFn: mockQueryFn,
          limit: 50,
        }),
      { wrapper }
    );

    await waitFor(() => {
      expect(mockQueryFn).toHaveBeenCalledWith(0, 50);
    });
  });

  it('should use default limit when not provided', async () => {
    mockQueryFn.mockResolvedValue([]);

    renderHook(
      () =>
        useInfiniteScroll({
          queryKey: ['test'],
          queryFn: mockQueryFn,
        }),
      { wrapper }
    );

    await waitFor(() => {
      expect(mockQueryFn).toHaveBeenCalledWith(0, 100);
    });
  });
});