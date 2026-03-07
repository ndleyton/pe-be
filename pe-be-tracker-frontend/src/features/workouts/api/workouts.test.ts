import { describe, it, expect, vi, beforeEach } from "vitest";
import { getMyWorkouts, type Workout } from "@/features/workouts";
import api from "@/shared/api/client";
import {
  makeOngoingWorkout,
  makePaginatedWorkouts,
  makeWorkout,
  makeWorkouts,
  makeWorkoutWithStringId,
} from "@/test/fixtures";

vi.mock("@/shared/api/client", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

const mockApi = api as any;

describe("workouts API - pagination", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getMyWorkouts", () => {
    const mockWorkouts: Workout[] = [
      makeWorkout({
        id: 1,
        name: "Morning Workout",
        notes: "Great session",
        start_time: "2024-01-01T08:00:00Z",
        end_time: "2024-01-01T09:00:00Z",
        created_at: "2024-01-01T08:00:00Z",
        updated_at: "2024-01-01T09:00:00Z",
      }),
      makeWorkout({
        id: 2,
        name: "Evening Workout",
        notes: null,
        start_time: "2024-01-01T18:00:00Z",
        end_time: "2024-01-01T19:30:00Z",
        created_at: "2024-01-01T18:00:00Z",
        updated_at: "2024-01-01T19:30:00Z",
      }),
    ];

    it("should call API with default pagination parameters", async () => {
      mockApi.get.mockResolvedValue({
        data: makePaginatedWorkouts(mockWorkouts),
      });

      const result = await getMyWorkouts();

      expect(mockApi.get).toHaveBeenCalledWith("/workouts/mine?limit=100");
      expect(result.data).toEqual(mockWorkouts);
    });

    it("should call API with custom pagination parameters", async () => {
      mockApi.get.mockResolvedValue({
        data: makePaginatedWorkouts(mockWorkouts),
      });

      await getMyWorkouts(20, 50);
      expect(mockApi.get).toHaveBeenCalledWith(
        "/workouts/mine?cursor=20&limit=50",
      );
    });

    it("should handle offset 0 and limit 100", async () => {
      mockApi.get.mockResolvedValue({
        data: makePaginatedWorkouts(mockWorkouts),
      });

      await getMyWorkouts(0, 100);
      expect(mockApi.get).toHaveBeenCalledWith(
        "/workouts/mine?cursor=0&limit=100",
      );
    });

    it("should handle large offset values", async () => {
      mockApi.get.mockResolvedValue({ data: makePaginatedWorkouts([]) });

      await getMyWorkouts(1000, 100);
      expect(mockApi.get).toHaveBeenCalledWith(
        "/workouts/mine?cursor=1000&limit=100",
      );
    });

    it("should handle small limit values", async () => {
      mockApi.get.mockResolvedValue({
        data: makePaginatedWorkouts(mockWorkouts.slice(0, 1)),
      });

      await getMyWorkouts(0, 1);
      expect(mockApi.get).toHaveBeenCalledWith(
        "/workouts/mine?cursor=0&limit=1",
      );
    });

    it("should omit cursor param when null and include only limit", async () => {
      mockApi.get.mockResolvedValue({ data: makePaginatedWorkouts([]) });

      await getMyWorkouts(null, 25);

      expect(mockApi.get).toHaveBeenCalledWith("/workouts/mine?limit=25");
    });

    it("should pass through next_cursor from server", async () => {
      const next = 9999;
      mockApi.get.mockResolvedValue({
        data: makePaginatedWorkouts(mockWorkouts, next),
      });

      const result = await getMyWorkouts();

      expect(result.data).toEqual(mockWorkouts);
      expect(result.next_cursor).toBe(next);
      expect(mockApi.get).toHaveBeenCalledWith("/workouts/mine?limit=100");
    });

    it("should handle API errors", async () => {
      const apiError = new Error("API Error");
      mockApi.get.mockRejectedValue(apiError);

      await expect(getMyWorkouts()).rejects.toThrow("API Error");
    });

    it("should handle 401 unauthorized errors", async () => {
      const unauthorizedError = {
        response: { status: 401 },
        message: "Unauthorized",
      };
      mockApi.get.mockRejectedValue(unauthorizedError);

      await expect(getMyWorkouts()).rejects.toEqual(unauthorizedError);
    });

    it("should handle empty response", async () => {
      mockApi.get.mockResolvedValue({ data: makePaginatedWorkouts([]) });

      const result = await getMyWorkouts(100, 100);
      expect(result.data).toEqual([]);
      expect(mockApi.get).toHaveBeenCalledWith(
        "/workouts/mine?cursor=100&limit=100",
      );
    });

    it("should handle response with exactly limit items", async () => {
      const fullPageData: Workout[] = makeWorkouts(100, (i) => ({
        id: i + 1,
        name: `Workout ${i + 1}`,
        notes: `Notes ${i + 1}`,
        start_time: `2024-01-0${(i % 9) + 1}T08:00:00Z`,
        end_time: `2024-01-0${(i % 9) + 1}T09:00:00Z`,
        created_at: `2024-01-0${(i % 9) + 1}T08:00:00Z`,
        updated_at: `2024-01-0${(i % 9) + 1}T09:00:00Z`,
      }));

      mockApi.get.mockResolvedValue({
        data: makePaginatedWorkouts(fullPageData),
      });

      const result = await getMyWorkouts(0, 100);
      expect(result.data).toHaveLength(100);
      expect(mockApi.get).toHaveBeenCalledWith(
        "/workouts/mine?cursor=0&limit=100",
      );
    });

    it("should handle response with less than limit items", async () => {
      const partialPageData = mockWorkouts.slice(0, 1);
      mockApi.get.mockResolvedValue({
        data: makePaginatedWorkouts(partialPageData),
      });

      const result = await getMyWorkouts(50, 100);
      expect(result.data).toHaveLength(1);
      expect(mockApi.get).toHaveBeenCalledWith(
        "/workouts/mine?cursor=50&limit=100",
      );
    });

    it("should handle workouts with null values", async () => {
      const workoutsWithNulls: Workout[] = [
        makeOngoingWorkout({
          id: 1,
          name: null,
          notes: null,
          start_time: "2024-01-01T08:00:00Z",
          created_at: "2024-01-01T08:00:00Z",
          updated_at: "2024-01-01T08:00:00Z",
        }),
      ];

      mockApi.get.mockResolvedValue({
        data: makePaginatedWorkouts(workoutsWithNulls),
      });

      const result = await getMyWorkouts();

      expect(result.data).toEqual(workoutsWithNulls);
      expect(result.data[0].name).toBeNull();
      expect(result.data[0].notes).toBeNull();
      expect(result.data[0].end_time).toBeNull();
    });

    it("should handle string IDs", async () => {
      const workoutsWithStringIds: Workout[] = [
        makeWorkoutWithStringId({
          id: "workout-uuid-1",
        }),
      ];

      mockApi.get.mockResolvedValue({
        data: makePaginatedWorkouts(workoutsWithStringIds),
      });

      const result = await getMyWorkouts();

      expect(result.data).toEqual(workoutsWithStringIds);
      expect(typeof result.data[0].id).toBe("string");
    });
  });
});
