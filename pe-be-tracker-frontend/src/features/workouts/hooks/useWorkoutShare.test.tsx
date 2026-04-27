import { QueryClient } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ProfileMe } from "@/features/profile/types";
import { updateWorkout } from "@/features/workouts/api";
import { makeWorkout } from "@/test/fixtures";
import { useWorkoutShare } from "./useWorkoutShare";

const { mockUpdateWorkout, mockToastError, mockToastSuccess } = vi.hoisted(() => ({
  mockUpdateWorkout: vi.fn(),
  mockToastError: vi.fn(),
  mockToastSuccess: vi.fn(),
}));

vi.mock("@/features/workouts/api", () => ({
  updateWorkout: mockUpdateWorkout,
}));

vi.mock("sonner", () => ({
  toast: {
    error: mockToastError,
    success: mockToastSuccess,
  },
}));

const profile: ProfileMe = {
  username: "casey",
  is_profile_public: true,
};

const createQueryClient = () =>
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

const setNavigatorShare = (share?: (data?: ShareData) => Promise<void>) => {
  Object.defineProperty(navigator, "share", {
    configurable: true,
    value: share,
  });
};

const setClipboardWriteText = (writeText: (value: string) => Promise<void>) => {
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: {
      writeText,
    },
  });
};

describe("useWorkoutShare", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdateWorkout.mockResolvedValue(makeWorkout({ visibility: "public" }));
    setNavigatorShare(undefined);
    setClipboardWriteText(vi.fn().mockResolvedValue(undefined));
  });

  it("flips a private workout to public before sharing", async () => {
    const queryClient = createQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const writeText = vi.fn().mockResolvedValue(undefined);
    setClipboardWriteText(writeText);

    const { result } = renderHook(() =>
      useWorkoutShare({
        profile,
        workoutId: "42",
        serverWorkout: makeWorkout({ id: 42, visibility: "private" }),
        workoutName: "Push Day",
        queryClient,
      }),
    );

    await act(async () => {
      await result.current.share();
    });

    expect(updateWorkout).toHaveBeenCalledWith("42", { visibility: "public" });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["workout", "42"] });
    expect(writeText).toHaveBeenCalledWith(
      `${window.location.origin}/u/casey/activities/42`,
    );
  });

  it("uses native sharing when available", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    setNavigatorShare(share);

    const { result } = renderHook(() =>
      useWorkoutShare({
        profile,
        workoutId: "99",
        serverWorkout: makeWorkout({ id: 99, visibility: "public" }),
        workoutName: "Legs",
        queryClient: createQueryClient(),
      }),
    );

    await act(async () => {
      await result.current.share();
    });

    expect(share).toHaveBeenCalledWith({
      title: "Workout: Legs",
      url: `${window.location.origin}/u/casey/activities/99`,
    });
    expect(mockToastSuccess).toHaveBeenCalledWith("Workout shared!");
    expect(updateWorkout).not.toHaveBeenCalled();
  });

  it("falls back to clipboard sharing and shows success feedback", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    setClipboardWriteText(writeText);

    const { result } = renderHook(() =>
      useWorkoutShare({
        profile,
        workoutId: "77",
        serverWorkout: makeWorkout({ id: 77, visibility: "public" }),
        workoutName: "Pull Day",
        queryClient: createQueryClient(),
      }),
    );

    await act(async () => {
      await result.current.share();
    });

    expect(writeText).toHaveBeenCalledWith(
      `${window.location.origin}/u/casey/activities/77`,
    );
    expect(mockToastSuccess).toHaveBeenCalledWith(
      "Workout link copied to clipboard!",
    );
  });

  it("shows an error and stops when the visibility flip fails", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    setNavigatorShare(share);
    mockUpdateWorkout.mockRejectedValue(new Error("Nope"));

    const { result } = renderHook(() =>
      useWorkoutShare({
        profile,
        workoutId: "42",
        serverWorkout: makeWorkout({ id: 42, visibility: "private" }),
        workoutName: "Push Day",
        queryClient: createQueryClient(),
      }),
    );

    await act(async () => {
      await result.current.share();
    });

    expect(mockToastError).toHaveBeenCalledWith(
      "Could not set workout to public.",
    );
    expect(share).not.toHaveBeenCalled();
  });

  it("suppresses AbortError from native share but reports other share failures", async () => {
    const abortError = new Error("Canceled");
    abortError.name = "AbortError";
    const share = vi.fn().mockRejectedValueOnce(abortError);
    setNavigatorShare(share);

    const { result, rerender } = renderHook(
      ({ workoutId }: { workoutId: string }) =>
        useWorkoutShare({
          profile,
          workoutId,
          serverWorkout: makeWorkout({ id: workoutId, visibility: "public" }),
          workoutName: null,
          queryClient: createQueryClient(),
        }),
      {
        initialProps: { workoutId: "5" },
      },
    );

    await act(async () => {
      await result.current.share();
    });

    expect(mockToastError).not.toHaveBeenCalled();

    share.mockRejectedValueOnce(new Error("Share failed"));
    rerender({ workoutId: "6" });

    await act(async () => {
      await result.current.share();
    });

    expect(mockToastError).toHaveBeenCalledWith("Failed to share workout.");
  });
});
