import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { act } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { makeWorkout, makeWorkoutPhoto } from "@/test/fixtures";

const { mockUploadWorkoutPhoto, mockToastError } = vi.hoisted(() => ({
  mockUploadWorkoutPhoto: vi.fn(),
  mockToastError: vi.fn(),
}));

vi.mock("@/features/workouts/api", async () => {
  const actual = await vi.importActual<
    typeof import("@/features/workouts/api")
  >("@/features/workouts/api");
  return {
    ...actual,
    uploadWorkoutPhoto: mockUploadWorkoutPhoto,
  };
});

vi.mock("sonner", () => ({
  toast: {
    error: mockToastError,
  },
}));

import { useWorkoutPhotoUpload } from "./useWorkoutPhotoUpload";

const createWrapper = (queryClient: QueryClient) =>
  ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

describe("useWorkoutPhotoUpload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("URL", {
      ...URL,
      createObjectURL: vi.fn(() => "blob:preview"),
      revokeObjectURL: vi.fn(),
    });
  });

  it("uploads a workout photo and updates the workout cache", async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    queryClient.setQueryData(
      ["workout", "123"],
      makeWorkout({ id: 123, photo: null }),
    );
    mockUploadWorkoutPhoto.mockResolvedValue(
      makeWorkoutPhoto({
        workout_id: 123,
        url: "http://localhost:8000/api/v1/workouts/123/photo/file",
      }),
    );

    const { result } = renderHook(
      () =>
        useWorkoutPhotoUpload({
          isAuthenticated: true,
          workoutId: "123",
        }),
      {
        wrapper: createWrapper(queryClient),
      },
    );

    await act(async () => {
      await result.current.uploadWorkoutPhoto(
        new File(["photo"], "progress.png", { type: "image/png" }),
      );
    });

    await waitFor(() => {
      expect(mockUploadWorkoutPhoto).toHaveBeenCalledWith(
        "123",
        expect.any(File),
      );
    });
    expect(result.current.workoutPhotoPreviewUrl).toBe("blob:preview");
    expect(queryClient.getQueryData(["workout", "123"])).toMatchObject({
      photo: expect.objectContaining({
        url: "http://localhost:8000/api/v1/workouts/123/photo/file",
      }),
    });
  });

  it("clears the preview and shows an error toast when upload fails", async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    mockUploadWorkoutPhoto.mockRejectedValue(new Error("Upload failed"));

    const { result } = renderHook(
      () =>
        useWorkoutPhotoUpload({
          isAuthenticated: true,
          workoutId: "123",
        }),
      {
        wrapper: createWrapper(queryClient),
      },
    );

    await act(async () => {
      await expect(
        result.current.uploadWorkoutPhoto(
          new File(["photo"], "progress.png", { type: "image/png" }),
        ),
      ).rejects.toThrow("Upload failed");
    });

    expect(result.current.workoutPhotoPreviewUrl).toBeNull();
    expect(mockToastError).toHaveBeenCalledWith("Failed to upload workout photo.");
  });
});
