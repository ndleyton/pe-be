import { renderHook, waitFor, act } from "@/test/testUtils";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { makeExerciseType } from "@/test/fixtures";
import type { GuestExerciseType } from "@/stores/useGuestStore";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockCreateExerciseType = vi.fn();
const mockGetExerciseTypes = vi.fn();

vi.mock("@/features/exercises/api", async () => {
  const actual =
    await vi.importActual<typeof import("@/features/exercises/api")>(
      "@/features/exercises/api",
    );

  return {
    ...actual,
    createExerciseType: (...args: unknown[]) => mockCreateExerciseType(...args),
    getExerciseTypes: (...args: unknown[]) => mockGetExerciseTypes(...args),
  };
});

import { useExerciseTypeCreation } from "./useExerciseTypeCreation";

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
      mutations: {
        retry: false,
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

describe("useExerciseTypeCreation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateExerciseType.mockResolvedValue(
      makeExerciseType({ id: 999, name: "Created Exercise" }),
    );
    mockGetExerciseTypes.mockResolvedValue({ data: [], next_cursor: null });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows create when only fuzzy matches are present", () => {
    const { result } = renderHook(
      () =>
        useExerciseTypeCreation({
          searchTerm: "Deadlift",
          deferredSearchTerm: "Deadlift",
          exerciseTypes: [makeExerciseType({ id: 1, name: "Romanian Deadlift" })],
          isSearchingWithoutResults: false,
          isAuthenticated: true,
          lookupLimit: 100,
          onResolvedExerciseType: vi.fn(),
        }),
      { wrapper },
    );

    expect(result.current.showCreateButton).toBe(true);
  });

  it("hides create when an exact match is already present", () => {
    const { result } = renderHook(
      () =>
        useExerciseTypeCreation({
          searchTerm: "Deadlift",
          deferredSearchTerm: "Deadlift",
          exerciseTypes: [
            makeExerciseType({ id: 1, name: "Romanian Deadlift" }),
            makeExerciseType({ id: 2, name: "Deadlift" }),
          ],
          isSearchingWithoutResults: false,
          isAuthenticated: true,
          lookupLimit: 100,
          onResolvedExerciseType: vi.fn(),
        }),
      { wrapper },
    );

    expect(result.current.showCreateButton).toBe(false);
  });

  it("uses the shared default unit heuristic when creating authenticated exercise types", async () => {
    const onResolvedExerciseType = vi.fn();
    const { result } = renderHook(
      () =>
        useExerciseTypeCreation({
          searchTerm: "Running Intervals",
          deferredSearchTerm: "Running Intervals",
          exerciseTypes: [],
          isSearchingWithoutResults: false,
          isAuthenticated: true,
          lookupLimit: 100,
          onResolvedExerciseType,
        }),
      { wrapper },
    );

    act(() => {
      result.current.handleCreateExerciseType();
    });

    await waitFor(() => {
      expect(mockCreateExerciseType).toHaveBeenCalledWith(
        {
          name: "Running Intervals",
          description: "Custom exercise",
          default_intensity_unit: 3,
        },
        expect.anything(),
      );
      expect(onResolvedExerciseType).toHaveBeenCalledWith(
        expect.objectContaining({ id: 999 }),
      );
    });
  });

  it("uses the guest creation callback when unauthenticated", () => {
    const onResolvedExerciseType = vi.fn();
    const createGuestExerciseType = vi
      .fn<(payload: unknown) => GuestExerciseType>()
      .mockReturnValue({
        id: "guest-1",
        name: "Custom Guest Exercise",
        description: "Custom exercise",
        default_intensity_unit: 1,
        times_used: 0,
      });
    const { result } = renderHook(
      () =>
        useExerciseTypeCreation({
          searchTerm: "Custom Guest Exercise",
          deferredSearchTerm: "Custom Guest Exercise",
          exerciseTypes: [],
          isSearchingWithoutResults: false,
          isAuthenticated: false,
          lookupLimit: 100,
          onResolvedExerciseType,
          createGuestExerciseType,
        }),
      { wrapper },
    );

    act(() => {
      result.current.handleCreateExerciseType();
    });

    expect(createGuestExerciseType).toHaveBeenCalledWith({
      name: "Custom Guest Exercise",
      description: "Custom exercise",
      default_intensity_unit: 1,
    });
    expect(mockCreateExerciseType).not.toHaveBeenCalled();
    expect(onResolvedExerciseType).toHaveBeenCalledWith(
      expect.objectContaining({ id: "guest-1" }),
    );
  });
});
