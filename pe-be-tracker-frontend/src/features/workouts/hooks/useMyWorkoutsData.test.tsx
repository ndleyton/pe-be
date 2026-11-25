import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
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
});
