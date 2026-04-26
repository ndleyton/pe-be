import { type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getMyProfile, updateMyProfile } from "@/features/profile/api";
import {
  PROFILE_ME_QUERY_KEY,
  usePublicProfileSettings,
} from "./usePublicProfileSettings";

vi.mock("@/features/profile/api", () => ({
  getMyProfile: vi.fn(),
  updateMyProfile: vi.fn(),
}));

const mockGetMyProfile = vi.mocked(getMyProfile);
const mockUpdateMyProfile = vi.mocked(updateMyProfile);

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  return { queryClient, wrapper };
};

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, reject, resolve };
};

describe("usePublicProfileSettings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("exposes loading while profile settings are pending", () => {
    const pendingProfile = deferred<Awaited<ReturnType<typeof getMyProfile>>>();
    mockGetMyProfile.mockReturnValue(pendingProfile.promise);

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => usePublicProfileSettings(true), {
      wrapper,
    });

    expect(result.current.isLoading).toBe(true);
  });

  it("syncs username from loaded profile and allows local edits", async () => {
    mockGetMyProfile.mockResolvedValue({
      username: "jane",
      is_profile_public: false,
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => usePublicProfileSettings(true), {
      wrapper,
    });

    await waitFor(() => expect(result.current.username).toBe("jane"));

    act(() => result.current.setUsername(" jane-lifts "));

    expect(result.current.username).toBe("jane-lifts");
  });

  it("does not overwrite in-progress username edits when profile data arrives", async () => {
    const pendingProfile = deferred<Awaited<ReturnType<typeof getMyProfile>>>();
    mockGetMyProfile.mockReturnValue(pendingProfile.promise);

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => usePublicProfileSettings(true), {
      wrapper,
    });

    act(() => result.current.setUsernameFocused(true));
    act(() => result.current.setUsername("draft-name"));

    await act(async () => {
      pendingProfile.resolve({
        username: "server-name",
        is_profile_public: false,
      });
      await pendingProfile.promise;
    });

    await waitFor(() =>
      expect(result.current.profile?.username).toBe("server-name"),
    );
    expect(result.current.username).toBe("draft-name");

    act(() => result.current.setUsernameFocused(false));

    expect(result.current.username).toBe("draft-name");
  });

  it("derives mutation error messages from API details", async () => {
    mockGetMyProfile.mockResolvedValue({
      username: null,
      is_profile_public: false,
    });
    mockUpdateMyProfile.mockRejectedValue({
      isAxiosError: true,
      response: { data: { detail: "Username is already taken" } },
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => usePublicProfileSettings(true), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => result.current.setUsername("taken"));
    act(() => result.current.createProfile());

    await waitFor(() =>
      expect(result.current.errorMessage).toBe("Username is already taken"),
    );
  });

  it("derives mutation error messages from FastAPI validation arrays", async () => {
    mockGetMyProfile.mockResolvedValue({
      username: null,
      is_profile_public: false,
    });
    mockUpdateMyProfile.mockRejectedValue({
      isAxiosError: true,
      response: {
        data: {
          detail: [
            {
              loc: ["body", "username"],
              msg: "Value error, Username must be at least 3 characters long",
              type: "value_error",
            },
          ],
        },
      },
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => usePublicProfileSettings(true), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => result.current.setUsername("55"));
    act(() => result.current.createProfile());

    await waitFor(() =>
      expect(result.current.errorMessage).toBe(
        "Username must be at least 3 characters long",
      ),
    );
  });

  it("creates a public profile from the local username", async () => {
    mockGetMyProfile.mockResolvedValue({
      username: null,
      is_profile_public: false,
    });
    mockUpdateMyProfile.mockResolvedValue({
      username: "jane",
      is_profile_public: true,
    });

    const { queryClient, wrapper } = createWrapper();
    const { result } = renderHook(() => usePublicProfileSettings(true), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => result.current.setUsername(" jane "));
    act(() => result.current.createProfile());

    await waitFor(() =>
      expect(mockUpdateMyProfile).toHaveBeenCalledWith(
        expect.objectContaining({
          username: "jane",
          is_profile_public: true,
        }),
      ),
    );
    await waitFor(() => expect(result.current.profile?.username).toBe("jane"));
    expect(result.current.username).toBe("jane");
    expect(queryClient.getQueryData(PROFILE_ME_QUERY_KEY)).toEqual({
      username: "jane",
      is_profile_public: true,
    });
  });

  it("toggles existing profile visibility", async () => {
    mockGetMyProfile.mockResolvedValue({
      username: "jane",
      is_profile_public: false,
    });
    mockUpdateMyProfile.mockResolvedValue({
      username: "jane",
      is_profile_public: true,
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => usePublicProfileSettings(true), {
      wrapper,
    });

    await waitFor(() => expect(result.current.profile?.username).toBe("jane"));

    act(() => result.current.toggleVisibility());

    await waitFor(() =>
      expect(mockUpdateMyProfile).toHaveBeenCalledWith(
        expect.objectContaining({
          is_profile_public: true,
        }),
      ),
    );
    await waitFor(() =>
      expect(result.current.profile?.is_profile_public).toBe(true),
    );
  });
});
