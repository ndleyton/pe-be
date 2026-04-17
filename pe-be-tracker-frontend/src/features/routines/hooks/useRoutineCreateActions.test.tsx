import { type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import { MemoryRouter, useNavigate } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createRoutine, type CreateRoutineData } from "@/features/routines/api";
import { buildRoutinePayload } from "@/features/routines/lib/routineEditor";
import { type Routine } from "@/features/routines/types";
import { getWorkoutTypes } from "@/features/workouts/api/workoutTypeApi";

import { useRoutineCreateActions } from "./useRoutineCreateActions";

// Mock the API and lib functions
vi.mock("@/features/routines/api", () => ({
  createRoutine: vi.fn(),
}));

vi.mock("@/features/routines/lib/routineEditor", () => ({
  buildRoutinePayload: vi.fn(),
}));

vi.mock("@/features/workouts/api/workoutTypeApi", () => ({
  getWorkoutTypes: vi.fn(),
}));

// Mock useNavigate
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: vi.fn(),
  };
});

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
      mutations: {
        retry: false,
      },
    },
  });

describe("useRoutineCreateActions", () => {
  const mockNavigate = vi.fn();
  const mockCreateRoutine = vi.mocked(createRoutine);
  const mockBuildRoutinePayload = vi.mocked(buildRoutinePayload);
  const mockGetWorkoutTypes = vi.mocked(getWorkoutTypes);

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useNavigate).mockReturnValue(mockNavigate);
    mockGetWorkoutTypes.mockResolvedValue([
      {
        id: 42,
        name: "Strength Training",
        description: "Default",
        created_at: "2025-01-01T00:00:00Z",
        updated_at: "2025-01-01T00:00:00Z",
      },
    ]);
  });


  const TestWrapper = ({
    children,
    queryClient = createTestQueryClient(),
  }: {
    children: ReactNode;
    queryClient?: QueryClient;
  }) => (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  );

  const defaultProps = {
    description: "Test Description",
    editorTemplates: [],
    isAuthenticated: true,
    name: "Test Routine",
    visibility: "private" as const,
    author: "Test Author",
    category: "Test Category",
  };

  it("(1) auth-guard: rejects when not authenticated", async () => {
    const { result } = renderHook(
      () =>
        useRoutineCreateActions({ ...defaultProps, isAuthenticated: false }),
      {
        wrapper: TestWrapper,
      },
    );

    await expect(result.current.saveMutation.mutateAsync()).rejects.toThrow(
      "Sign in to create a routine.",
    );
    expect(mockCreateRoutine).not.toHaveBeenCalled();
  });

  it("(2) payload shaping: trims data and resolves the default workout type from cached data", async () => {
    const props = {
      ...defaultProps,
      name: "  Trimmed Name  ",
      description: "  Trimmed Desc  ",
      author: "  Trimmed Author  ",
      category: "  Trimmed Category  ",
    };

    const mockPayload = [
      { exercise_type_id: 1, notes: null, set_templates: [] },
    ] satisfies CreateRoutineData["exercise_templates"];
    mockBuildRoutinePayload.mockReturnValue(mockPayload);
    mockCreateRoutine.mockResolvedValue({ id: 123 } as unknown as Routine);

    const { result } = renderHook(() => useRoutineCreateActions(props), {
      wrapper: TestWrapper,
    });

    await result.current.saveMutation.mutateAsync();

    expect(mockBuildRoutinePayload).toHaveBeenCalledWith(props.editorTemplates);
    expect(mockCreateRoutine).toHaveBeenCalledWith({
      name: "Trimmed Name",
      description: "Trimmed Desc",
      workout_type_id: 42,
      visibility: "private",
      author: "Trimmed Author",
      category: "Trimmed Category",
      exercise_templates: mockPayload,
    });
  });

  it("(2) payload shaping: falls back to the first available workout type", async () => {
    mockGetWorkoutTypes.mockResolvedValue([
      {
        id: 7,
        name: "Other",
        description: "Fallback",
        created_at: "2025-01-01T00:00:00Z",
        updated_at: "2025-01-01T00:00:00Z",
      },
    ]);
    mockCreateRoutine.mockResolvedValue({ id: 123 } as unknown as Routine);

    const { result } = renderHook(() => useRoutineCreateActions(defaultProps), {
      wrapper: TestWrapper,
    });

    await result.current.saveMutation.mutateAsync();

    expect(mockCreateRoutine).toHaveBeenCalledWith(
      expect.objectContaining({
        workout_type_id: 7,
      }),
    );
  });

  it("(2) payload shaping: coerces empty description/author/category to null", async () => {
    const props = {
      ...defaultProps,
      description: "   ",
      author: "",
      category: "  ",
    };

    mockCreateRoutine.mockResolvedValue({ id: 123 } as unknown as Routine);

    const { result } = renderHook(() => useRoutineCreateActions(props), {
      wrapper: TestWrapper,
    });

    await result.current.saveMutation.mutateAsync();

    expect(mockCreateRoutine).toHaveBeenCalledWith(
      expect.objectContaining({
        description: null,
        author: null,
        category: null,
      }),
    );
  });

  it("(3) cache invalidation: calls invalidateQueries on success", async () => {
    mockCreateRoutine.mockResolvedValue({ id: 123 } as unknown as Routine);

    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useRoutineCreateActions(defaultProps), {
      wrapper: ({ children }) => (
        <TestWrapper queryClient={queryClient}>{children}</TestWrapper>
      ),
    });

    await result.current.saveMutation.mutateAsync();

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["routines"] });
  });

  it("(4) navigation: redirects to the new routine page on success", async () => {
    const createdRoutine = { id: 456 } as unknown as Routine;
    mockCreateRoutine.mockResolvedValue(createdRoutine);
    const onBeforeNavigate = vi.fn();

    const { result } = renderHook(
      () =>
        useRoutineCreateActions({
          ...defaultProps,
          onBeforeNavigate,
        }),
      {
        wrapper: TestWrapper,
      },
    );

    await result.current.saveMutation.mutateAsync();

    expect(onBeforeNavigate).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith(`/routines/${createdRoutine.id}`);
  });
});
