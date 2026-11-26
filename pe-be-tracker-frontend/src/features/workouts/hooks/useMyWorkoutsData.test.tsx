import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getMyWorkouts } from "../api";
import { useMyWorkoutsData } from "./useMyWorkoutsData";
import { makeGuestWorkout, makeWorkout } from "@/test/fixtures";

const mockAuthState = {
  isAuthenticated: false,
  loading: true,
  initialized: false,
  hasSessionHint: false,
};

const mockGuestState = {
  hydrated: true,
  workouts: [makeGuestWorkout({ id: "guest-1", name: "Guest Push" })],
};

vi.mock("@/stores", () => ({
  useAuthStore: (selector: (state: typeof mockAuthState) => unknown) =>
    selector(mockAuthState),
  useGuestStore: (selector: (state: typeof mockGuestState) => unknown) =>
    selector(mockGuestState),
}));

vi.mock("../api", () => ({
  getMyWorkouts: vi.fn(),
}));

const mockGetMyWorkouts = vi.mocked(getMyWorkouts);

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });

  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe("useMyWorkoutsData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthState.isAuthenticated = false;
    mockAuthState.loading = true;
    mockAuthState.initialized = false;
    mockAuthState.hasSessionHint = false;
    mockGuestState.hydrated = true;
  });

  it("returns local guest workouts immediately when uninitialized without a session hint", () => {
    const { result } = renderHook(() => useMyWorkoutsData(), {
      wrapper: createWrapper(),
    });

    expect(mockGetMyWorkouts).not.toHaveBeenCalled();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.hasLoadedWorkouts).toBe(true);
    expect(result.current.workouts).toHaveLength(1);
    expect(result.current.workouts[0].name).toBe("Guest Push");
  });

  it("fetches server workouts in parallel with auth when a session hint is present", async () => {
    mockAuthState.hasSessionHint = true;
    mockGetMyWorkouts.mockResolvedValueOnce({
      data: [makeWorkout({ id: 99, name: "Server Pull" })],
      next_cursor: null,
    });

    const { result } = renderHook(() => useMyWorkoutsData(), {
      wrapper: createWrapper(),
    });

    expect(mockGetMyWorkouts).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.workouts).toHaveLength(1);
    expect(result.current.workouts[0].name).toBe("Server Pull");
  });

  it("falls back cleanly to guest workouts when an expired session hint resolves unauthenticated", () => {
    mockAuthState.hasSessionHint = true;
    mockGetMyWorkouts.mockReturnValue(new Promise(() => {}));

    const { result, rerender } = renderHook(() => useMyWorkoutsData(), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);

    mockAuthState.initialized = true;
    mockAuthState.loading = false;
    mockAuthState.isAuthenticated = false;
    mockAuthState.hasSessionHint = false;
    rerender();

    expect(result.current.isLoading).toBe(false);
    expect(result.current.workouts[0].name).toBe("Guest Push");
  });

  it("completes an unchanged multi-page refetch without triggering repeated-cursor errors", async () => {
    mockAuthState.initialized = true;
    mockAuthState.loading = false;
    mockAuthState.isAuthenticated = true;

    mockGetMyWorkouts.mockImplementation(async (cursor?: number | null) => {
      if (cursor === undefined) {
        return {
          data: [makeWorkout({ id: 101, name: "Page 1" })],
          next_cursor: 100,
        };
      }
      if (cursor === 100) {
        return {
          data: [makeWorkout({ id: 100, name: "Page 2" })],
          next_cursor: 50,
        };
      }
      return {
        data: [makeWorkout({ id: 50, name: "Page 3" })],
        next_cursor: null,
      };
    });

    const { result } = renderHook(() => useMyWorkoutsData(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.workouts).toHaveLength(1);
    });

    await act(async () => {
      await result.current.fetchNextPage();
    });
    await act(async () => {
      await result.current.fetchNextPage();
    });

    await waitFor(() => {
      expect(result.current.workouts).toHaveLength(3);
    });

    let refetchResult: Awaited<ReturnType<typeof result.current.refetch>>;
    await act(async () => {
      refetchResult = await result.current.refetch();
    });

    expect(refetchResult!.isError).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.workouts.map((w) => w.id)).toEqual([101, 100, 50]);
  });

  it("rejects a cursor repeated within the current fetch sequence", async () => {
    mockAuthState.initialized = true;
    mockAuthState.loading = false;
    mockAuthState.isAuthenticated = true;

    mockGetMyWorkouts
      .mockResolvedValueOnce({
        data: [makeWorkout({ id: 101, name: "Page 1" })],
        next_cursor: 100,
      })
      .mockResolvedValueOnce({
        data: [makeWorkout({ id: 100, name: "Page 2" })],
        next_cursor: 100,
      });

    const { result } = renderHook(() => useMyWorkoutsData(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.workouts).toHaveLength(1);
    });

    await act(async () => {
      await result.current.fetchNextPage();
    });

    let repeatedPageResult: Awaited<ReturnType<typeof result.current.fetchNextPage>>;
    await act(async () => {
      repeatedPageResult = await result.current.fetchNextPage();
    });

    expect(repeatedPageResult!.isError).toBe(true);
    expect(repeatedPageResult!.error).toEqual(
      expect.objectContaining({
        message: "Workouts pagination returned repeated cursor 100",
      }),
    );
  });

  it("rejects a cursor repeated during a refetch sequence", async () => {
    mockAuthState.initialized = true;
    mockAuthState.loading = false;
    mockAuthState.isAuthenticated = true;

    mockGetMyWorkouts
      .mockResolvedValueOnce({
        data: [makeWorkout({ id: 101, name: "Page 1" })],
        next_cursor: 100,
      })
      .mockResolvedValueOnce({
        data: [makeWorkout({ id: 100, name: "Page 2" })],
        next_cursor: 50,
      })
      .mockResolvedValueOnce({
        data: [makeWorkout({ id: 50, name: "Page 3" })],
        next_cursor: null,
      })
      // Refetch returns a loop: page 1 -> 100, page 2 -> 100
      .mockResolvedValueOnce({
        data: [makeWorkout({ id: 101, name: "Page 1" })],
        next_cursor: 100,
      })
      .mockResolvedValueOnce({
        data: [makeWorkout({ id: 100, name: "Page 2" })],
        next_cursor: 100,
      });

    const { result } = renderHook(() => useMyWorkoutsData(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.workouts).toHaveLength(1);
    });
    await act(async () => {
      await result.current.fetchNextPage();
    });
    await act(async () => {
      await result.current.fetchNextPage();
    });

    let refetchResult: Awaited<ReturnType<typeof result.current.refetch>>;
    await act(async () => {
      refetchResult = await result.current.refetch();
    });

    expect(refetchResult!.isError).toBe(true);
    expect(refetchResult!.error).toEqual(
      expect.objectContaining({
        message: "Workouts pagination returned repeated cursor 100",
      }),
    );
  });
});
