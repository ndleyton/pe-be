import { useCallback, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";

import {
  createPersonalAccessToken,
  listPersonalAccessTokens,
  revokePersonalAccessToken,
} from "@/features/mcp/api/personalAccessTokens";
import type {
  PersonalAccessTokenCreate,
  PersonalAccessTokenCreated,
  PersonalAccessTokenSummary,
} from "@/features/mcp/types";

export const PERSONAL_ACCESS_TOKENS_QUERY_KEY = [
  "personal-access-tokens",
] as const;

const shouldRetry = (failureCount: number, error: unknown): boolean => {
  if (
    axios.isAxiosError(error) &&
    (error.response?.status === 401 || error.response?.status === 403)
  ) {
    return false;
  }
  return failureCount < 3;
};

const cleanValidationMessage = (message: string): string =>
  message.replace(/^Value error,\s*/i, "").trim();

const getApiErrorMessage = (error: unknown, fallback: string): string | null => {
  if (!error) return null;
  if (!axios.isAxiosError(error)) return fallback;

  const detail: unknown = error.response?.data?.detail;
  if (typeof detail === "string") return cleanValidationMessage(detail);
  if (Array.isArray(detail)) {
    const messages = detail.flatMap((item) => {
      if (typeof item === "string") return [cleanValidationMessage(item)];
      if (item && typeof item === "object") {
        const message = (item as Record<string, unknown>).msg;
        if (typeof message === "string") return [cleanValidationMessage(message)];
      }
      return [];
    });
    if (messages.length > 0) return messages.join(" ");
  }
  return fallback;
};

export const usePersonalAccessTokens = (enabled: boolean) => {
  const queryClient = useQueryClient();
  const [createdToken, setCreatedToken] =
    useState<PersonalAccessTokenCreated | null>(null);

  const query = useQuery({
    queryKey: PERSONAL_ACCESS_TOKENS_QUERY_KEY,
    queryFn: listPersonalAccessTokens,
    enabled,
    retry: shouldRetry,
  });

  const createMutation = useMutation({
    mutationFn: (input: PersonalAccessTokenCreate) =>
      createPersonalAccessToken(input),
    onSuccess: (created) => {
      const { token: _plaintextToken, ...summary } = created;
      queryClient.setQueryData<PersonalAccessTokenSummary[]>(
        PERSONAL_ACCESS_TOKENS_QUERY_KEY,
        (current = []) => [summary, ...current],
      );
      setCreatedToken(created);
    },
  });

  const revokeMutation = useMutation({
    mutationFn: (tokenId: number) => revokePersonalAccessToken(tokenId),
    onSuccess: (_result, tokenId) => {
      queryClient.setQueryData<PersonalAccessTokenSummary[]>(
        PERSONAL_ACCESS_TOKENS_QUERY_KEY,
        (current = []) =>
          current.map((token) =>
            token.id === tokenId
              ? { ...token, revoked_at: new Date().toISOString() }
              : token,
          ),
      );
    },
  });

  const createToken = useCallback(
    (input: PersonalAccessTokenCreate) => {
      createMutation.reset();
      createMutation.mutate(input);
    },
    [createMutation],
  );

  const revokeToken = useCallback(
    (tokenId: number) => {
      revokeMutation.reset();
      revokeMutation.mutate(tokenId);
    },
    [revokeMutation],
  );

  const dismissCreatedToken = useCallback(() => {
    setCreatedToken(null);
    createMutation.reset();
  }, [createMutation]);

  return {
    tokens: query.data ?? [],
    createdToken,
    dismissCreatedToken,
    createToken,
    revokeToken,
    isLoading: query.isLoading,
    loadError: getApiErrorMessage(query.error, "Could not load access tokens."),
    createError: getApiErrorMessage(
      createMutation.error,
      "Could not create access token.",
    ),
    revokeError: getApiErrorMessage(
      revokeMutation.error,
      "Could not revoke access token.",
    ),
    isCreating: createMutation.isPending,
    revokingTokenId: revokeMutation.isPending
      ? revokeMutation.variables
      : null,
  };
};
