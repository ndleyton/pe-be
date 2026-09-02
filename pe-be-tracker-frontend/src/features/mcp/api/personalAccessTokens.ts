import api from "@/shared/api/client";
import { endpoints } from "@/shared/api/endpoints";
import type {
  PersonalAccessTokenCreate,
  PersonalAccessTokenCreated,
  PersonalAccessTokenSummary,
} from "@/features/mcp/types";

export const listPersonalAccessTokens = async (): Promise<
  PersonalAccessTokenSummary[]
> => {
  const response = await api.get(endpoints.personalAccessTokens);
  return response.data;
};

export const createPersonalAccessToken = async (
  input: PersonalAccessTokenCreate,
): Promise<PersonalAccessTokenCreated> => {
  const response = await api.post(endpoints.personalAccessTokens, input);
  return response.data;
};

export const revokePersonalAccessToken = async (
  tokenId: number,
): Promise<void> => {
  await api.delete(endpoints.personalAccessTokenById(tokenId));
};
