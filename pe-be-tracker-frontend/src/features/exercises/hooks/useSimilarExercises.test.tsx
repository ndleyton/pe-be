import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi, beforeEach } from "vitest";

import { renderHook, waitFor } from "@/test/testUtils";
import { getSimilarExerciseTypes } from "@/features/exercises/api";
import { makeExerciseType } from "@/test/fixtures";
import { useSimilarExercises } from "./useSimilarExercises";

vi.mock("@/features/exercises/api", async () => {
  const actual = await vi.importActual("@/features/exercises/api");
  return {
    ...actual,
    getSimilarExerciseTypes: vi.fn(),
  };
});

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  });

describe("useSimilarExercises", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = createTestQueryClient();
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  it("fetches similar exercises when an exercise type id is provided", async () => {
    vi.mocked(getSimilarExerciseTypes).mockResolvedValue({
      data: [
        {
          exercise_type: makeExerciseType({ id: 21, name: "Chest-Supported Row" }),
          match_reason: "same_primary_muscle",
        },
      ],
      strategy: "same_primary_muscle_then_group_by_times_used",
    });

    const { result } = renderHook(() => useSimilarExercises(12), { wrapper });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(getSimilarExerciseTypes).toHaveBeenCalledWith(12, 3);
    expect(result.current.similarExercises.data).toHaveLength(1);
  });

  it("does not fetch when the exercise type id is missing", () => {
    const { result } = renderHook(() => useSimilarExercises(undefined), {
      wrapper,
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.similarExercises.data).toEqual([]);
    expect(getSimilarExerciseTypes).not.toHaveBeenCalled();
  });
});
