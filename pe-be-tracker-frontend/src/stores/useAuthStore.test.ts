import { beforeEach, describe, expect, it, vi } from "vitest";
import api from "@/shared/api/client";
import { AUTH_SESSION_HINT_KEY, useAuthStore } from "./useAuthStore";

vi.mock("@/shared/api/client", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

const mockGet = vi.mocked(api.get);
const mockPost = vi.mocked(api.post);

describe("useAuthStore session hint", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    useAuthStore.setState({
      user: null,
      loading: true,
      isAuthenticated: false,
      initialized: false,
      hasSessionHint: false,
    });
  });

  it("persists the session hint when refresh succeeds", async () => {
    mockGet.mockResolvedValueOnce({
      data: { id: 7, email: "lifter@example.com" },
    });

    await useAuthStore.getState().refresh();

    expect(useAuthStore.getState().isAuthenticated).toBe(true);
    expect(useAuthStore.getState().hasSessionHint).toBe(true);
    expect(window.localStorage.getItem(AUTH_SESSION_HINT_KEY)).toBe("1");
  });

  it("clears the session hint when refresh fails", async () => {
    window.localStorage.setItem(AUTH_SESSION_HINT_KEY, "1");
    useAuthStore.setState({ hasSessionHint: true });
    mockGet.mockRejectedValueOnce(new Error("Unauthorized"));

    await useAuthStore.getState().refresh();

    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().hasSessionHint).toBe(false);
    expect(window.localStorage.getItem(AUTH_SESSION_HINT_KEY)).toBeNull();
  });

  it("updates the session hint when setUser is called", () => {
    useAuthStore.getState().setUser({ id: 3, email: "user@example.com" });
    expect(useAuthStore.getState().hasSessionHint).toBe(true);
    expect(window.localStorage.getItem(AUTH_SESSION_HINT_KEY)).toBe("1");

    useAuthStore.getState().setUser(null);
    expect(useAuthStore.getState().hasSessionHint).toBe(false);
    expect(window.localStorage.getItem(AUTH_SESSION_HINT_KEY)).toBeNull();
  });

  it("clears the session hint on signOut", async () => {
    window.localStorage.setItem(AUTH_SESSION_HINT_KEY, "1");
    useAuthStore.setState({
      user: { id: 3, email: "user@example.com" },
      isAuthenticated: true,
      hasSessionHint: true,
    });
    mockPost.mockResolvedValueOnce({ data: {} });

    await useAuthStore.getState().signOut();

    expect(useAuthStore.getState().hasSessionHint).toBe(false);
    expect(window.localStorage.getItem(AUTH_SESSION_HINT_KEY)).toBeNull();
  });
});
