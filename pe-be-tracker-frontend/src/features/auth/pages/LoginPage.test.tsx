import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import LoginPage from "./LoginPage";

const mockGoogleSignIn = vi.fn();
const mockAuthState = {
  isAuthenticated: false,
  loading: false,
  initialized: true,
};

vi.mock("@/features/auth/components", () => ({
  GoogleSignInButton: () => <div>Google Sign-In Button</div>,
}));

vi.mock("@/features/auth/hooks", () => ({
  useGoogleSignIn: () => mockGoogleSignIn,
}));

vi.mock("@/shared/components/layout", () => ({
  HomeLogo: () => <div>Home Logo</div>,
}));

vi.mock("@/stores/useAuthStore", () => ({
  useAuthStore: () => mockAuthState,
}));

const LocationProbe = () => {
  const location = useLocation();

  return (
    <div data-testid="location">
      {location.pathname}
      {location.search}
      {location.hash}
    </div>
  );
};

const renderLoginRoute = (initialEntry: string) =>
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route
          path="/login"
          element={(
            <>
              <LoginPage />
              <LocationProbe />
            </>
          )}
        />
        <Route path="*" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  );

describe("LoginPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    mockAuthState.isAuthenticated = false;
    mockAuthState.loading = false;
    mockAuthState.initialized = true;
  });

  it("redirects authenticated users to a safe next path", async () => {
    mockAuthState.isAuthenticated = true;

    renderLoginRoute("/login?auth_intent=google&next=/chat");

    expect(screen.queryByText("Google Sign-In Button")).not.toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByTestId("location")).toHaveTextContent("/chat");
    });
    expect(mockGoogleSignIn).not.toHaveBeenCalled();
  });

  it("falls back to workouts for unsafe next paths", async () => {
    mockAuthState.isAuthenticated = true;

    renderLoginRoute("/login?next=https://evil.example");

    await waitFor(() => {
      expect(screen.getByTestId("location")).toHaveTextContent("/workouts");
    });
  });

  it("starts google sign-in after stripping auth intent from the URL", async () => {
    renderLoginRoute("/login?auth_intent=google&next=/chat&utm_source=landing");

    expect(screen.getByText("Redirecting to Google...")).toBeInTheDocument();
    expect(screen.queryByText("Google Sign-In Button")).not.toBeInTheDocument();

    await waitFor(() => {
      expect(mockGoogleSignIn).toHaveBeenCalledTimes(1);
    });
    expect(screen.getByTestId("location")).toHaveTextContent("/login");
    expect(screen.getByTestId("location")).not.toHaveTextContent("auth_intent");
    expect(sessionStorage.getItem("auth:post-login-destination")).toBe("/chat");
  });

  it("sends guest users to the requested next path", async () => {
    renderLoginRoute("/login?next=/about");

    await screen.getByRole("button", { name: "Try as Guest" }).click();

    await waitFor(() => {
      expect(screen.getByTestId("location")).toHaveTextContent("/about");
    });
  });
});
