import { fireEvent, renderHook, waitFor } from "@/test/testUtils";
import {
  makeExerciseType,
  makeMuscleGroup,
  makePaginatedExerciseTypes,
} from "@/test/fixtures";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockGetExerciseTypes = vi.fn();
const mockGetMuscleGroups = vi.fn();

vi.mock("@/features/exercises/api", () => ({
  getExerciseTypes: (...args: unknown[]) => mockGetExerciseTypes(...args),
  getMuscleGroups: (...args: unknown[]) => mockGetMuscleGroups(...args),
}));

import { useExerciseTypesPagination } from "./useExerciseTypesPagination";

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
  return React.createElement(
    QueryClientProvider,
    { client: queryClient },
    children,
  );
};

describe("useExerciseTypesPagination", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(document.documentElement, "scrollTop", {
      value: 0,
      configurable: true,
    });
    Object.defineProperty(document.documentElement, "scrollHeight", {
      value: 1000,
      configurable: true,
    });
    Object.defineProperty(window, "innerHeight", {
      value: 800,
      configurable: true,
    });

    mockGetExerciseTypes.mockResolvedValue(
      makePaginatedExerciseTypes([
        makeExerciseType({ id: 1, name: "Push-ups" }),
      ]),
    );
    mockGetMuscleGroups.mockResolvedValue([
      makeMuscleGroup({ id: 1, name: "Chest" }),
    ]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("loads browse exercise types and muscle groups by default", async () => {
    const { result } = renderHook(
      () =>
        useExerciseTypesPagination({
          orderBy: "usage",
          activeMuscleGroupId: undefined,
          normalizedSearchTerm: "",
          trimmedDeferredSearchTerm: "",
          isSearchActive: false,
        }),
      { wrapper },
    );

    await waitFor(() => {
      expect(mockGetExerciseTypes).toHaveBeenCalledWith(
        "usage",
        undefined,
        100,
        undefined,
      );
      expect(mockGetMuscleGroups).toHaveBeenCalledTimes(1);
      expect(result.current.exerciseTypes).toHaveLength(1);
      expect(result.current.muscleGroups).toHaveLength(1);
    });
  });

  it("loads search results when search is active", async () => {
    mockGetExerciseTypes.mockImplementation(
      async (
        _orderBy?: "usage" | "name",
        _cursor?: number | null,
        _limit?: number,
        _muscleGroupId?: number,
        name?: string,
      ) =>
        name
          ? makePaginatedExerciseTypes([
              makeExerciseType({ id: 2, name: `${name} Match` }),
            ])
          : makePaginatedExerciseTypes([
              makeExerciseType({ id: 1, name: "Push-ups" }),
            ]),
    );

    const { result } = renderHook(
      () =>
        useExerciseTypesPagination({
          orderBy: "usage",
          activeMuscleGroupId: undefined,
          normalizedSearchTerm: "deadlift",
          trimmedDeferredSearchTerm: "Deadlift",
          isSearchActive: true,
        }),
      { wrapper },
    );

    await waitFor(() => {
      expect(mockGetExerciseTypes).toHaveBeenCalledWith(
        "usage",
        undefined,
        100,
        undefined,
        "Deadlift",
      );
      expect(result.current.exerciseTypes[0]?.name).toBe("Deadlift Match");
    });
  });

  it("fetches the next browse page when the window scroll reaches the threshold", async () => {
    mockGetExerciseTypes.mockImplementation(
      async (
        _orderBy?: "usage" | "name",
        cursor?: number | null,
      ) => {
        if (cursor === 100) {
          return makePaginatedExerciseTypes([
            makeExerciseType({ id: 2, name: "Squats" }),
          ]);
        }

        return makePaginatedExerciseTypes(
          [makeExerciseType({ id: 1, name: "Push-ups" })],
          100,
        );
      },
    );

    const { result } = renderHook(
      () =>
        useExerciseTypesPagination({
          orderBy: "usage",
          activeMuscleGroupId: undefined,
          normalizedSearchTerm: "",
          trimmedDeferredSearchTerm: "",
          isSearchActive: false,
        }),
      { wrapper },
    );

    await waitFor(() => {
      expect(result.current.exerciseTypes).toHaveLength(1);
      expect(result.current.hasMore).toBe(true);
    });

    Object.defineProperty(document.documentElement, "scrollTop", {
      value: 900,
      configurable: true,
    });

    fireEvent.scroll(window);

    await waitFor(() => {
      expect(mockGetExerciseTypes).toHaveBeenCalledWith(
        "usage",
        100,
        100,
        undefined,
      );
      expect(result.current.exerciseTypes).toHaveLength(2);
    });
  });
});
