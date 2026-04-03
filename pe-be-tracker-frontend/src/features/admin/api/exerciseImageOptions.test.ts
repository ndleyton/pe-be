import { beforeEach, describe, expect, it, vi } from "vitest";

import api from "@/shared/api/client";
import {
  applyExerciseImageOption,
  generateExerciseImageOptions,
  getExerciseImageOptions,
} from "./exerciseImageOptions";

vi.mock("@/shared/api/client", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

vi.mock("@/app/config/env", () => ({
  config: {
    apiBaseUrl: "/api/v1",
  },
}));

const mockApi = api as unknown as {
  get: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
};

describe("exerciseImageOptions API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads image options for an exercise type", async () => {
    const payload = {
      exercise_type_id: 12,
      exercise_name: "Bench Press",
      current_images: ["/api/v1/exercises/assets/published/example.png"],
      reference_images: ["/api/v1/exercises/assets/references/example.png"],
      supports_revert_to_reference: true,
      available_options: [],
      options: [],
    };
    mockApi.get.mockResolvedValueOnce({ data: payload });

    const result = await getExerciseImageOptions(12);

    expect(mockApi.get).toHaveBeenCalledWith(
      "/admin/exercise-types/12/reference-image-options",
    );
    expect(result.current_images[0]).toBe(
      "http://localhost:3000/api/v1/exercises/assets/published/example.png",
    );
    expect(result.reference_images[0]).toBe(
      "http://localhost:3000/api/v1/exercises/assets/references/example.png",
    );
  });

  it("triggers idempotent generation for an exercise type", async () => {
    const payload = {
      exercise_type_id: 12,
      exercise_name: "Bench Press",
      current_images: [],
      reference_images: [],
      supports_revert_to_reference: true,
      available_options: [],
      options: [
        {
          key: "minimal-outline",
          label: "Minimal Outline",
          description: "desc",
          option_source: "reference_redraw",
          images: ["/api/v1/exercises/assets/generated/example.png"],
          candidate_ids: [1],
          source_images: ["/api/v1/exercises/assets/references/example.png"],
          is_current: false,
        },
      ],
    };
    mockApi.post.mockResolvedValueOnce({ data: payload });

    const result = await generateExerciseImageOptions(12, {
      option_key: "minimal-outline",
    });

    expect(mockApi.post).toHaveBeenCalledWith(
      "/admin/exercise-types/12/reference-image-options/generate",
      { option_key: "minimal-outline" },
    );
    expect(result.options[0].images[0]).toBe(
      "http://localhost:3000/api/v1/exercises/assets/generated/example.png",
    );
  });

  it("applies a chosen option", async () => {
    const payload = {
      exercise_type_id: 12,
      exercise_name: "Bench Press",
      current_images: [],
      reference_images: [],
      supports_revert_to_reference: true,
      available_options: [],
      options: [],
    };
    mockApi.post.mockResolvedValueOnce({ data: payload });

    const result = await applyExerciseImageOption(12, {
      option_key: "clean-outline",
    });

    expect(mockApi.post).toHaveBeenCalledWith(
      "/admin/exercise-types/12/reference-image-options/apply",
      { option_key: "clean-outline" },
    );
    expect(result.exercise_type_id).toBe(12);
  });
});
