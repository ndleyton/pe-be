export type PersonalAccessTokenScope = "trainer:read" | "trainer:write";

export interface PersonalAccessTokenCreate {
  name: string;
  scopes: PersonalAccessTokenScope[];
  expires_in_days: number;
}

export interface PersonalAccessTokenSummary {
  id: number;
  name: string;
  token_prefix: string;
  scopes: PersonalAccessTokenScope[];
  expires_at: string;
  revoked_at: string | null;
  last_used_at: string | null;
  created_at: string;
}

export interface PersonalAccessTokenCreated
  extends PersonalAccessTokenSummary {
  token: string;
}
