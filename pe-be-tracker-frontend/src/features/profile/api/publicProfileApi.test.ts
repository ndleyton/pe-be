import { beforeEach, describe, expect, it, vi } from "vitest";

import api from "@/shared/api/client";
import {
  getPublicActivities,
  getPublicActivity,
  getPublicProfile,
  savePublicActivityAsRoutine,
} from "@/features/profile/api";

vi.mock("@/shared/api/client", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

describe("public profile api", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reads public profile data from the profiles boundary", async () => {
    vi.mocked(api.get).mockResolvedValueOnce({
      data: { username: "jane", public_workout_count: 2 },
    });

    await expect(getPublicProfile("jane")).resolves.toMatchObject({
      username: "jane",
    });

    expect(api.get).toHaveBeenCalledWith("/profiles/jane");
  });

  it("reads activities and activity detail", async () => {
    vi.mocked(api.get)
      .mockResolvedValueOnce({ data: { data: [], next_cursor: null } })
      .mockResolvedValueOnce({ data: { id: 10, exercises: [] } });

    await getPublicActivities("jane", 50, 10);
    await getPublicActivity("jane", 10);

    expect(api.get).toHaveBeenNthCalledWith(
      1,
      "/profiles/jane/activities",
      { params: { cursor: 50, limit: 10 } },
    );
    expect(api.get).toHaveBeenNthCalledWith(
      2,
      "/profiles/jane/activities/10",
    );
  });

  it("saves a public activity as a routine", async () => {
    vi.mocked(api.post).mockResolvedValueOnce({ data: { id: 99 } });

    await expect(savePublicActivityAsRoutine("jane", 10)).resolves.toEqual({
      id: 99,
    });

    expect(api.post).toHaveBeenCalledWith(
      "/profiles/jane/activities/10/save-as-routine",
    );
  });
});
