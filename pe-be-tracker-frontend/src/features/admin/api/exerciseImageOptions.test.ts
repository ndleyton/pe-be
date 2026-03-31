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

const mockApi = api as unknown as {
  get: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
};

describe("exerciseImageOptions API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads image options for an exercise type", async () => {
    const payload = { exercise_type_id: 12, options: [] };
    mockApi.get.mockResolvedValueOnce({ data: payload });

    const result = await getExerciseImageOptions(12);

    expect(mockApi.get).toHaveBeenCalledWith(
      "/admin/exercise-types/12/reference-image-options",
    );
    expect(result).toEqual(payload);
  });

  it("triggers idempotent generation for an exercise type", async () => {
    const payload = { exercise_type_id: 12, options: [] };
    mockApi.post.mockResolvedValueOnce({ data: payload });

    const result = await generateExerciseImageOptions(12);

    expect(mockApi.post).toHaveBeenCalledWith(
      "/admin/exercise-types/12/reference-image-options/generate",
    );
    expect(result).toEqual(payload);
  });

  it("applies a chosen option", async () => {
    const payload = { exercise_type_id: 12, options: [] };
    mockApi.post.mockResolvedValueOnce({ data: payload });

    const result = await applyExerciseImageOption(12, {
      option_key: "clean-outline",
    });

    expect(mockApi.post).toHaveBeenCalledWith(
      "/admin/exercise-types/12/reference-image-options/apply",
      { option_key: "clean-outline" },
    );
    expect(result).toEqual(payload);
  });
});
