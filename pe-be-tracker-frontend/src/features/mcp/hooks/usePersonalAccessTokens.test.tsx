import { type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createPersonalAccessToken,
  listPersonalAccessTokens,
  revokePersonalAccessToken,
} from "@/features/mcp/api/personalAccessTokens";
import type {
  PersonalAccessTokenCreated,
  PersonalAccessTokenSummary,
} from "@/features/mcp/types";
import {
  PERSONAL_ACCESS_TOKENS_QUERY_KEY,
  usePersonalAccessTokens,
} from "./usePersonalAccessTokens";

vi.mock("@/features/mcp/api/personalAccessTokens", () => ({
  createPersonalAccessToken: vi.fn(),
  listPersonalAccessTokens: vi.fn(),
  revokePersonalAccessToken: vi.fn(),
}));

const mockCreateToken = vi.mocked(createPersonalAccessToken);
const mockListTokens = vi.mocked(listPersonalAccessTokens);
const mockRevokeToken = vi.mocked(revokePersonalAccessToken);

const summary: PersonalAccessTokenSummary = {
  id: 7,
  name: "Claude Desktop",
  token_prefix: "abc123def456",
  scopes: ["trainer:read", "trainer:write"],
  expires_at: "2027-01-01T00:00:00Z",
  revoked_at: null,
  last_used_at: null,
  created_at: "2026-09-02T00:00:00Z",
};

const created: PersonalAccessTokenCreated = {
  ...summary,
  token: "pebe_pat_abc123def456_secret",
};

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { queryClient, wrapper };
};

describe("usePersonalAccessTokens", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListTokens.mockResolvedValue([]);
  });

  it("does not load tokens while settings are disabled", () => {
    const { wrapper } = createWrapper();

    renderHook(() => usePersonalAccessTokens(false), { wrapper });

    expect(mockListTokens).not.toHaveBeenCalled();
  });

  it("reveals a new secret once without storing it in the query cache", async () => {
    mockCreateToken.mockResolvedValue(created);
    const { queryClient, wrapper } = createWrapper();
    const { result } = renderHook(() => usePersonalAccessTokens(true), {
      wrapper,
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() =>
      result.current.createToken({
        name: "Claude Desktop",
        scopes: ["trainer:read", "trainer:write"],
        expires_in_days: 90,
      }),
    );

    await waitFor(() => expect(result.current.createdToken).toEqual(created));
    expect(mockCreateToken).toHaveBeenCalledWith({
      name: "Claude Desktop",
      scopes: ["trainer:read", "trainer:write"],
      expires_in_days: 90,
    });
    expect(
      queryClient.getQueryData(PERSONAL_ACCESS_TOKENS_QUERY_KEY),
    ).toEqual([summary]);

    act(() => result.current.dismissCreatedToken());
    expect(result.current.createdToken).toBeNull();
  });

  it("marks a successfully revoked token in the cache", async () => {
    mockListTokens.mockResolvedValue([summary]);
    mockRevokeToken.mockResolvedValue(undefined);
    const { queryClient, wrapper } = createWrapper();
    const { result } = renderHook(() => usePersonalAccessTokens(true), {
      wrapper,
    });
    await waitFor(() => expect(result.current.tokens).toHaveLength(1));

    act(() => result.current.revokeToken(summary.id));

    await waitFor(() => expect(mockRevokeToken).toHaveBeenCalledWith(7));
    await waitFor(() => {
      const cached = queryClient.getQueryData<PersonalAccessTokenSummary[]>(
        PERSONAL_ACCESS_TOKENS_QUERY_KEY,
      );
      expect(cached?.[0].revoked_at).not.toBeNull();
    });
  });
});
