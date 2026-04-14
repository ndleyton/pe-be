import { type ReactNode } from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { usePostLoginCompletion } from "./usePostLoginCompletion";

const mocks = vi.hoisted(() => {
  const authState = {
    refresh: vi.fn(),
    user: null as null | { id: number; email: string },
  };
  const guestState = {
    hydrated: true,
    workouts: [] as Array<{ id: string }>,
    syncWithServer: vi.fn(),
  };
  const consumePostLoginDestination = vi.fn();

  return {
    authState,
    guestState,
    consumePostLoginDestination,
  };
});

vi.mock("@/features/auth/lib/postLoginRedirect", () => ({
  consumePostLoginDestination: mocks.consumePostLoginDestination,
}));

vi.mock("@/stores", () => ({
  useAuthStore: Object.assign(
    (selector: (state: typeof mocks.authState) => unknown) =>
      selector(mocks.authState),
    {
      getState: () => mocks.authState,
    },
  ),
  useGuestStore: Object.assign(
    (selector: (state: typeof mocks.guestState) => unknown) =>
      selector(mocks.guestState),
    {
      getState: () => mocks.guestState,
    },
  ),
}));

const wrapper = ({ children }: { children: ReactNode }) => (
  <MemoryRouter>{children}</MemoryRouter>
);

describe("usePostLoginCompletion", () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    mocks.authState.user = null;
    mocks.authState.refresh.mockReset();
    mocks.guestState.hydrated = true;
    mocks.guestState.workouts = [];
    mocks.guestState.syncWithServer.mockReset();
    mocks.consumePostLoginDestination.mockReturnValue(null);
  });

  it("waits for guest store hydration before snapshotting workouts and syncing", async () => {
    let resolveSync: (value: boolean) => void = () => {};

    mocks.guestState.hydrated = false;
    mocks.authState.refresh.mockImplementation(async () => {
      mocks.authState.user = { id: 1, email: "user@example.com" };
    });
    mocks.guestState.syncWithServer.mockImplementation(
      () =>
        new Promise<boolean>((resolve) => {
          resolveSync = resolve;
        }),
    );

    const { result, rerender } = renderHook(() => usePostLoginCompletion(), {
      wrapper,
    });

    expect(mocks.authState.refresh).not.toHaveBeenCalled();
    expect(mocks.guestState.syncWithServer).not.toHaveBeenCalled();
    expect(result.current.initialGuestWorkoutCount).toBe(0);

    mocks.guestState.workouts = [{ id: "guest-workout-1" }];
    mocks.guestState.hydrated = true;
    rerender();

    await waitFor(() => {
      expect(mocks.authState.refresh).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(result.current.syncStatus).toBe("syncing");
    });
    expect(result.current.initialGuestWorkoutCount).toBe(1);
    expect(mocks.guestState.syncWithServer).toHaveBeenCalledTimes(1);

    resolveSync(true);
  });

  it("returns error state when the backend session does not materialize", async () => {
    mocks.authState.refresh.mockResolvedValue(undefined);

    const { result } = renderHook(() => usePostLoginCompletion(), {
      wrapper,
    });

    await waitFor(() => {
      expect(result.current.syncStatus).toBe("error");
    });
    expect(result.current.errorMessage).toBe(
      "We couldn't confirm your session. Please try signing in again.",
    );
  });
});
