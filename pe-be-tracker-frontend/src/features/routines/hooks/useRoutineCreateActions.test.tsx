import { type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import { MemoryRouter, useNavigate } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createRoutine } from "@/features/routines/api";
import { buildRoutinePayload } from "@/features/routines/lib/routineEditor";

import { useRoutineCreateActions } from "./useRoutineCreateActions";

// Mock the API and lib functions
vi.mock("@/features/routines/api", () => ({
  createRoutine: vi.fn(),
}));

vi.mock("@/features/routines/lib/routineEditor", () => ({
  buildRoutinePayload: vi.fn(),
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

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useNavigate).mockReturnValue(mockNavigate);
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

  it("(2) payload shaping: trims data and uses correct default workout type", async () => {
    const props = {
      ...defaultProps,
      name: "  Trimmed Name  ",
      description: "  Trimmed Desc  ",
      author: "  Trimmed Author  ",
      category: "  Trimmed Category  ",
    };

    const mockPayload = [{ exercise_type_id: 1, set_templates: [] }] as any;
    mockBuildRoutinePayload.mockReturnValue(mockPayload);
    mockCreateRoutine.mockResolvedValue({ id: 123 } as any);

    const { result } = renderHook(() => useRoutineCreateActions(props), {
      wrapper: TestWrapper,
    });

    await result.current.saveMutation.mutateAsync();

    expect(mockBuildRoutinePayload).toHaveBeenCalledWith(props.editorTemplates);
    expect(mockCreateRoutine).toHaveBeenCalledWith({
      name: "Trimmed Name",
      description: "Trimmed Desc",
      workout_type_id: 4, // DEFAULT_WORKOUT_TYPE_ID
      visibility: "private",
      author: "Trimmed Author",
      category: "Trimmed Category",
      exercise_templates: mockPayload,
    });
  });

  it("(2) payload shaping: coerces empty description/author/category to null", async () => {
    const props = {
      ...defaultProps,
      description: "   ",
      author: "",
      category: "  ",
    };

    mockCreateRoutine.mockResolvedValue({ id: 123 } as any);

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
    mockCreateRoutine.mockResolvedValue({ id: 123 } as any);

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
    const createdRoutine = { id: 456 } as any;
    mockCreateRoutine.mockResolvedValue(createdRoutine);

    const { result } = renderHook(() => useRoutineCreateActions(defaultProps), {
      wrapper: TestWrapper,
    });

    await result.current.saveMutation.mutateAsync();

    expect(mockNavigate).toHaveBeenCalledWith(`/routines/${createdRoutine.id}`);
  });
});
