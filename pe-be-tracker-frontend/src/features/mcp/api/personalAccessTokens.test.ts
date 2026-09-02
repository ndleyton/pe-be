import { beforeEach, describe, expect, it, vi } from "vitest";

import api from "@/shared/api/client";
import {
  createPersonalAccessToken,
  listPersonalAccessTokens,
  revokePersonalAccessToken,
} from "@/features/mcp/api/personalAccessTokens";

vi.mock("@/shared/api/client", () => ({
  default: {
    delete: vi.fn(),
    get: vi.fn(),
    post: vi.fn(),
  },
}));

describe("personal access token api", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists tokens from the authenticated user collection", async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: [] });

    await expect(listPersonalAccessTokens()).resolves.toEqual([]);

    expect(api.get).toHaveBeenCalledWith(
      "/users/me/personal-access-tokens/",
    );
  });

  it("creates a scoped token with an explicit expiration", async () => {
    const input = {
      name: "Claude Desktop",
      scopes: ["trainer:read", "trainer:write"] as const,
      expires_in_days: 90,
    };
    vi.mocked(api.post).mockResolvedValueOnce({
      data: { id: 7, ...input, token: "pebe_pat_prefix_secret" },
    });

    await createPersonalAccessToken({ ...input, scopes: [...input.scopes] });

    expect(api.post).toHaveBeenCalledWith(
      "/users/me/personal-access-tokens/",
      input,
    );
  });

  it("revokes a token by id", async () => {
    vi.mocked(api.delete).mockResolvedValueOnce({ data: undefined });

    await expect(revokePersonalAccessToken(7)).resolves.toBeUndefined();

    expect(api.delete).toHaveBeenCalledWith(
      "/users/me/personal-access-tokens/7",
    );
  });
});
