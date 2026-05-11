import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { updateWorkout } from "@/features/workouts/api";
import { useGuestStore } from "@/stores";
import { makeWorkout } from "@/test/fixtures";

import { useWorkoutNameUpdate } from "./useWorkoutNameUpdate";

// Mock dependencies
vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock("@/features/workouts/api", () => ({
  updateWorkout: vi.fn(),
}));

const mockGuestUpdateWorkout = vi.fn();
vi.mock("@/stores", () => ({
  useGuestStore: (selector: (state: any) => any) =>
    selector({
      updateWorkout: mockGuestUpdateWorkout,
    }),
}));

const mockQueryClient = {
  cancelQueries: vi.fn().mockResolvedValue(undefined),
  getQueryData: vi.fn(),
  setQueryData: vi.fn(),
  invalidateQueries: vi.fn(),
};

vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual<typeof import("@tanstack/react-query")>(
    "@tanstack/react-query",
  );
  return {
    ...actual,
    useQueryClient: () => mockQueryClient,
  };
});

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe("useWorkoutNameUpdate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls updateWorkout when authenticated", async () => {
    const workoutId = "123";
    const newName = "New Workout Name";
    const updatedWorkout = makeWorkout({ id: 123, name: newName });
    vi.mocked(updateWorkout).mockResolvedValue(updatedWorkout);

    const { result } = renderHook(
      () => useWorkoutNameUpdate({ isAuthenticated: true, workoutId }),
      { wrapper: createWrapper() },
    );

    result.current.mutate(newName);

    await waitFor(() => {
      expect(updateWorkout).toHaveBeenCalledWith(workoutId, { name: newName });
    });
  });

  it("calls guestUpdateWorkout when not authenticated", async () => {
    const workoutId = "guest-123";
    const newName = "New Guest Name";

    const { result } = renderHook(
      () => useWorkoutNameUpdate({ isAuthenticated: false, workoutId }),
      { wrapper: createWrapper() },
    );

    result.current.mutate(newName);

    await waitFor(() => {
      expect(mockGuestUpdateWorkout).toHaveBeenCalledWith(workoutId, {
        name: newName,
      });
    });
    expect(updateWorkout).not.toHaveBeenCalled();
  });

  it("performs optimistic cache updates in onMutate", async () => {
    const workoutId = "123";
    const newName = "Optimistic Name";
    const previousWorkout = makeWorkout({ id: 123, name: "Old Name" });
    const previousWorkouts = { data: [previousWorkout], next_cursor: null };

    mockQueryClient.getQueryData.mockImplementation((key) => {
      if (key[0] === "workout") return previousWorkout;
      if (key[0] === "workouts") return previousWorkouts;
      return null;
    });

    const { result } = renderHook(
      () => useWorkoutNameUpdate({ isAuthenticated: true, workoutId }),
      { wrapper: createWrapper() },
    );

    result.current.mutate(newName);

    await waitFor(() => {
      expect(mockQueryClient.cancelQueries).toHaveBeenCalledWith({
        queryKey: ["workout", workoutId],
      });
      expect(mockQueryClient.cancelQueries).toHaveBeenCalledWith({
        queryKey: ["workouts"],
      });
    });

    // Verify optimistic setQueryData for single workout
    const workoutUpdater = mockQueryClient.setQueryData.mock.calls.find(
      (call) => call[0][0] === "workout",
    )?.[1];
    expect(workoutUpdater(previousWorkout)).toMatchObject({
      name: newName,
      updated_at: expect.any(String),
    });

    // Verify optimistic setQueryData for workouts list
    const workoutsUpdater = mockQueryClient.setQueryData.mock.calls.find(
      (call) => call[0][0] === "workouts",
    )?.[1];
    const updatedWorkoutsList = workoutsUpdater(previousWorkouts);
    expect(updatedWorkoutsList.data[0].name).toBe(newName);
  });

  it("restores previous cache state in onError", async () => {
    const workoutId = "123";
    const previousWorkout = makeWorkout({ id: 123, name: "Old Name" });
    const previousWorkouts = { data: [previousWorkout], next_cursor: null };

    // Set up context for onError
    mockQueryClient.getQueryData.mockImplementation((key) => {
      if (key[0] === "workout") return previousWorkout;
      if (key[0] === "workouts") return previousWorkouts;
      return null;
    });

    vi.mocked(updateWorkout).mockRejectedValue(new Error("Update failed"));

    const { result } = renderHook(
      () => useWorkoutNameUpdate({ isAuthenticated: true, workoutId }),
      { wrapper: createWrapper() },
    );

    result.current.mutate("Failing Name");

    await waitFor(() => {
      expect(mockQueryClient.setQueryData).toHaveBeenCalledWith(
        ["workout", workoutId],
        previousWorkout,
      );
      expect(mockQueryClient.setQueryData).toHaveBeenCalledWith(
        ["workouts"],
        previousWorkouts,
      );
      expect(toast.error).toHaveBeenCalledWith("Could not update workout name.");
    });
  });

  it("replaces cache entries with real updatedWorkout in onSuccess", async () => {
    const workoutId = "123";
    const updatedWorkout = makeWorkout({ id: 123, name: "Success Name" });
    vi.mocked(updateWorkout).mockResolvedValue(updatedWorkout);

    const { result } = renderHook(
      () => useWorkoutNameUpdate({ isAuthenticated: true, workoutId }),
      { wrapper: createWrapper() },
    );

    result.current.mutate("Success Name");

    await waitFor(() => {
      expect(mockQueryClient.setQueryData).toHaveBeenCalledWith(
        ["workout", workoutId],
        updatedWorkout,
      );
    });

    // Verify workouts list update in onSuccess
    const workoutsUpdater = mockQueryClient.setQueryData.mock.calls.find(
      (call) => call[0][0] === "workouts",
    )?.[1];
    const initialList = { data: [makeWorkout({ id: 123, name: "Old" })] };
    const updatedList = workoutsUpdater(initialList);
    expect(updatedList.data[0]).toEqual(updatedWorkout);
  });

  it("invalidates workouts query onSettled", async () => {
    const workoutId = "123";
    vi.mocked(updateWorkout).mockResolvedValue(makeWorkout({ id: 123 }));

    const { result } = renderHook(
      () => useWorkoutNameUpdate({ isAuthenticated: true, workoutId }),
      { wrapper: createWrapper() },
    );

    result.current.mutate("Settled Name");

    await waitFor(() => {
      expect(mockQueryClient.invalidateQueries).toHaveBeenCalledWith({
        queryKey: ["workouts"],
      });
    });
  });

  it("throws error if workoutId is missing", async () => {
    const { result } = renderHook(
      () => useWorkoutNameUpdate({ isAuthenticated: true, workoutId: undefined }),
      { wrapper: createWrapper() },
    );

    result.current.mutate("New Name");

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
      expect(result.current.error?.message).toBe("Workout id is required.");
    });
  });

  it("handles null or empty name", async () => {
    const workoutId = "123";
    vi.mocked(updateWorkout).mockResolvedValue(makeWorkout({ id: 123, name: null }));

    const { result } = renderHook(
      () => useWorkoutNameUpdate({ isAuthenticated: true, workoutId }),
      { wrapper: createWrapper() },
    );

    result.current.mutate(null);

    await waitFor(() => {
      expect(updateWorkout).toHaveBeenCalledWith(workoutId, { name: null });
    });
  });
});
