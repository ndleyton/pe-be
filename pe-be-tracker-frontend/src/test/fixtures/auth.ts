type AuthUser = {
  id: number;
  email: string;
  name?: string | null;
};

let authUserFixtureId = 1;

export const makeUser = (
  overrides: Partial<AuthUser> = {},
): AuthUser => ({
  id: authUserFixtureId++,
  email: "test@example.com",
  name: "Test User",
  ...overrides,
});
