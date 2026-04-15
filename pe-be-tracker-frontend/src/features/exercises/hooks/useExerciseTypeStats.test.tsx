import { renderHook, waitFor } from "@/test/testUtils";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { useExerciseTypeStats } from "./useExerciseTypeStats";
import { getExerciseTypeStats } from "@/features/exercises/api";
import { makeExerciseType } from "@/test/fixtures";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  });

const { mockAuthState } = vi.hoisted(() => ({
  mockAuthState: {
    isAuthenticated: true,
  },
}));

vi.mock("@/stores/useAuthStore", () => ({
  useAuthStore: (selector: (state: typeof mockAuthState) => unknown) =>
    selector(mockAuthState),
}));

vi.mock("@/features/exercises/api", async () => {
  const actual = await vi.importActual("@/features/exercises/api");
  return {
    ...actual,
    getExerciseTypeStats: vi.fn(),
  };
});

describe("useExerciseTypeStats", () => {
  const mockStats = {
    personalBest: { weight: 100, reps: 5, date: "2023-01-01" },
    intensityUnit: { id: 1, abbreviation: "kg" },
  };

  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthState.isAuthenticated = true;
    queryClient = createTestQueryClient();
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  it("fetches stats when authenticated and exerciseTypeId is valid", async () => {
    vi.mocked(getExerciseTypeStats).mockResolvedValue(mockStats as any);
    const exerciseType = makeExerciseType({ id: 1 });

    const { result } = renderHook(() => useExerciseTypeStats(1, exerciseType), {
      wrapper,
    });

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.stats).toEqual(mockStats);
    expect(getExerciseTypeStats).toHaveBeenCalledWith("1");
  });

  it("does not fetch stats when unauthenticated", async () => {
    mockAuthState.isAuthenticated = false;
    const exerciseType = makeExerciseType({ id: 1 });

    const { result } = renderHook(() => useExerciseTypeStats(1, exerciseType), {
      wrapper,
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.stats).toBeUndefined();
    expect(getExerciseTypeStats).not.toHaveBeenCalled();
  });

  it("handles string exerciseTypeId correctly", async () => {
    vi.mocked(getExerciseTypeStats).mockResolvedValue(mockStats as any);
    const exerciseType = makeExerciseType({ id: "1" as any });

    const { result } = renderHook(() => useExerciseTypeStats("1", exerciseType), {
      wrapper,
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(getExerciseTypeStats).toHaveBeenCalledWith("1");
  });
});
