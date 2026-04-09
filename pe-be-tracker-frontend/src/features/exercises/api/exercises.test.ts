import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getExerciseTypes,
  getExercisesInWorkout,
  getMuscles,
  getMuscleGroups,
} from "./exercises";
import type { ExerciseType } from "@/features/exercises/types";
import api from "@/shared/api/client";
import { endpoints } from "@/shared/api/endpoints";
import {
  makeExerciseType,
  makeExerciseTypes,
  makePaginatedExerciseTypes,
  makeMuscle,
  makeMuscleGroup,
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

describe("exercises API - pagination", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getExercisesInWorkout", () => {
    it("should return exercises from the workout endpoint without extra fetches", async () => {
      const workoutExercises = [
        {
          id: 11,
          timestamp: "2024-01-01T00:00:00Z",
          notes: null,
          exercise_type_id: 1,
          workout_id: 5,
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:00:00Z",
          exercise_type: {
            id: 1,
            name: "Push-ups",
            description: "Classic bodyweight exercise",
            default_intensity_unit: 1,
            times_used: 10,
            muscles: [],
            images: [],
            images_url: null,
            created_at: "2024-01-01T00:00:00Z",
            updated_at: "2024-01-01T00:00:00Z",
          },
          exercise_sets: [],
        },
      ];

      mockApi.get.mockResolvedValueOnce({ data: workoutExercises });

      const result = await getExercisesInWorkout("5");

      expect(result).toEqual(workoutExercises);
      expect(mockApi.get).toHaveBeenCalledTimes(1);
      expect(mockApi.get).toHaveBeenCalledWith("/workouts/5/exercises");
    });
  });

  describe("getExerciseTypes", () => {
    const mockExerciseTypes: ExerciseType[] = [
      makeExerciseType({
        id: 1,
        name: "Push-ups",
        description: "Classic bodyweight exercise",
        muscle_groups: ["chest", "triceps"],
        usage_count: 10,
        default_intensity_unit: 1,
        times_used: 10,
      }),
      makeExerciseType({
        id: 2,
        name: "Squats",
        description: "Lower body exercise",
        muscle_groups: ["quadriceps", "glutes"],
        usage_count: 8,
        default_intensity_unit: 1,
        times_used: 8,
      }),
    ];

    it("should call API with default pagination parameters", async () => {
      mockApi.get.mockResolvedValue({
        data: makePaginatedExerciseTypes(mockExerciseTypes),
      });

      const result = await getExerciseTypes();

      expect(mockApi.get).toHaveBeenCalledWith(
        "/exercises/exercise-types/?order_by=usage&offset=0&limit=1000",
      );
      expect(result.data).toEqual(mockExerciseTypes);
    });

    it("should call API with custom order by parameter", async () => {
      mockApi.get.mockResolvedValue({
        data: makePaginatedExerciseTypes(mockExerciseTypes),
      });

      const result = await getExerciseTypes("name");

      expect(mockApi.get).toHaveBeenCalledWith(
        "/exercises/exercise-types/?order_by=name&offset=0&limit=1000",
      );
      expect(result.data).toEqual(mockExerciseTypes);
    });

    it("should call API with custom pagination parameters", async () => {
      mockApi.get.mockResolvedValue({
        data: makePaginatedExerciseTypes(mockExerciseTypes),
      });

      const result = await getExerciseTypes("usage", 20, 50);

      expect(mockApi.get).toHaveBeenCalledWith(
        "/exercises/exercise-types/?order_by=usage&offset=20&limit=50",
      );
      expect(result.data).toEqual(mockExerciseTypes);
    });

    it("should handle offset 0 and limit 100", async () => {
      mockApi.get.mockResolvedValue({
        data: makePaginatedExerciseTypes(mockExerciseTypes),
      });

      const result = await getExerciseTypes("usage", 0, 100);

      expect(mockApi.get).toHaveBeenCalledWith(
        "/exercises/exercise-types/?order_by=usage&offset=0&limit=100",
      );
      expect(result.data).toEqual(mockExerciseTypes);
    });

    it("should handle large offset values", async () => {
      mockApi.get.mockResolvedValue({
        data: makePaginatedExerciseTypes([]),
      });

      const result = await getExerciseTypes("usage", 1000, 100);

      expect(mockApi.get).toHaveBeenCalledWith(
        "/exercises/exercise-types/?order_by=usage&offset=1000&limit=100",
      );
      expect(result.data).toEqual([]);
    });

    it("should handle small limit values", async () => {
      mockApi.get.mockResolvedValue({
        data: makePaginatedExerciseTypes(mockExerciseTypes.slice(0, 1)),
      });

      const result = await getExerciseTypes("usage", 0, 1);

      expect(mockApi.get).toHaveBeenCalledWith(
        "/exercises/exercise-types/?order_by=usage&offset=0&limit=1",
      );
      expect(result.data).toEqual(mockExerciseTypes.slice(0, 1));
    });

    it("should handle API errors", async () => {
      const apiError = new Error("API Error");
      mockApi.get.mockRejectedValue(apiError);

      await expect(getExerciseTypes()).rejects.toThrow("API Error");
    });

    it("should handle empty response", async () => {
      mockApi.get.mockResolvedValue({
        data: makePaginatedExerciseTypes([]),
      });

      const result = await getExerciseTypes("usage", 100, 100);

      expect(result.data).toEqual([]);
      expect(mockApi.get).toHaveBeenCalledWith(
        "/exercises/exercise-types/?order_by=usage&offset=100&limit=100",
      );
    });

    it("should handle response with exactly limit items", async () => {
      const fullPageData: ExerciseType[] = makeExerciseTypes(100, (i) => ({
          id: i + 1,
          name: `Exercise ${i + 1}`,
          description: `Description ${i + 1}`,
          muscle_groups: ["test"],
          usage_count: i + 1,
          default_intensity_unit: 1,
          times_used: i + 1,
        }));

      mockApi.get.mockResolvedValue({
        data: makePaginatedExerciseTypes(fullPageData),
      });

      const result = await getExerciseTypes("usage", 0, 100);

      expect(result.data).toHaveLength(100);
      expect(mockApi.get).toHaveBeenCalledWith(
        "/exercises/exercise-types/?order_by=usage&offset=0&limit=100",
      );
    });

    it("should handle response with less than limit items", async () => {
      const partialPageData = mockExerciseTypes.slice(0, 1);
      mockApi.get.mockResolvedValue({
        data: makePaginatedExerciseTypes(partialPageData),
      });

      const result = await getExerciseTypes("usage", 50, 100);

      expect(result.data).toHaveLength(1);
      expect(mockApi.get).toHaveBeenCalledWith(
        "/exercises/exercise-types/?order_by=usage&offset=50&limit=100",
      );
    });

    it("should include muscle group filter when provided", async () => {
      mockApi.get.mockResolvedValue({
        data: makePaginatedExerciseTypes(mockExerciseTypes),
      });

      const result = await getExerciseTypes("usage", 0, 100, 7);

      expect(mockApi.get).toHaveBeenCalledWith(
        "/exercises/exercise-types/?order_by=usage&offset=0&limit=100&muscle_group_id=7",
      );
      expect(result.data).toEqual(mockExerciseTypes);
    });
  });

  describe("getMuscleGroups", () => {
    it("should fetch muscle groups from the API", async () => {
      const muscleGroups = [makeMuscleGroup({ id: 1, name: "Chest" })];
      mockApi.get.mockResolvedValue({ data: muscleGroups });

      const result = await getMuscleGroups();

      expect(mockApi.get).toHaveBeenCalledWith(endpoints.muscleGroups);
      expect(result).toEqual(muscleGroups);
    });
  });

  describe("getMuscles", () => {
    it("should fetch muscles from the API", async () => {
      const muscles = [
        makeMuscle({
          id: 1,
          name: "Pectoralis Major",
          muscle_group: makeMuscleGroup({ id: 10, name: "Chest" }),
        }),
      ];
      mockApi.get.mockResolvedValue({ data: muscles });

      const result = await getMuscles();

      expect(mockApi.get).toHaveBeenCalledWith(endpoints.muscles);
      expect(result).toEqual(muscles);
    });
  });
});
