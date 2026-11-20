import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeSyncResult } from "@/test/fixtures";
import type { SyncResult } from "@/utils/syncGuestData";
import OAuthCallbackPage from "./OAuthCallbackPage";

const mocks = vi.hoisted(() => {
  const authState = {
    refresh: vi.fn(),
    user: null as null | { id: number; email: string },
  };
  const guestState = {
    hydrated: true,
    workouts: [] as Array<{ id: string }>,
    syncClaimedWorkoutIds: [] as string[],
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

vi.mock("@/shared/components/layout", () => ({
  HomeLogo: () => <div>Home Logo</div>,
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

const renderPostLoginRoute = (initialEntry = "/auth/complete") =>
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route
          path="/auth/complete"
          element={(
            <>
              <OAuthCallbackPage />
              <LocationProbe />
            </>
          )}
        />
        <Route
          path="/oauth/callback"
          element={(
            <>
              <OAuthCallbackPage />
              <LocationProbe />
            </>
          )}
        />
        <Route path="*" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  );

describe("OAuthCallbackPage", () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    mocks.authState.user = null;
    mocks.authState.refresh.mockReset();
    mocks.guestState.hydrated = true;
    mocks.guestState.workouts = [];
    mocks.guestState.syncClaimedWorkoutIds = [];
    mocks.guestState.syncWithServer.mockReset();
    mocks.consumePostLoginDestination.mockReturnValue(null);
  });

  it("refreshes auth, waits for guest sync, and redirects to the stored destination", async () => {
    let resolveSync: (value: SyncResult) => void = () => {};

    mocks.consumePostLoginDestination.mockReturnValue("/chat");
    mocks.guestState.workouts = [{ id: "guest-workout-1" }];
    mocks.authState.refresh.mockImplementation(async () => {
      mocks.authState.user = { id: 1, email: "user@example.com" };
    });
    mocks.guestState.syncWithServer.mockImplementation(
      () =>
        new Promise<SyncResult>((resolve) => {
          resolveSync = resolve;
        }),
    );

    renderPostLoginRoute();

    await waitFor(() => {
      expect(mocks.authState.refresh).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(screen.getByText("Syncing your data...")).toBeInTheDocument();
    });
    expect(mocks.guestState.syncWithServer).toHaveBeenCalledTimes(1);

    resolveSync(makeSyncResult());

    await waitFor(() => {
      expect(screen.getByTestId("location")).toHaveTextContent("/chat");
    }, { timeout: 2000 });
  });

  it("redirects back to login when the backend session is missing", async () => {
    mocks.authState.refresh.mockResolvedValue(undefined);

    renderPostLoginRoute("/oauth/callback");

    await waitFor(() => {
      expect(
        screen.getByText("We couldn't confirm your session. Please try signing in again."),
      ).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByTestId("location")).toHaveTextContent("/login");
    }, { timeout: 4000 });
  });

  it("waits for guest store hydration before snapshotting workouts for sync", async () => {
    mocks.consumePostLoginDestination.mockReturnValue("/workouts");
    mocks.guestState.hydrated = false;
    mocks.authState.refresh.mockImplementation(async () => {
      mocks.authState.user = { id: 1, email: "user@example.com" };
    });
    mocks.guestState.syncWithServer.mockResolvedValue(makeSyncResult());

    const view = renderPostLoginRoute();

    expect(mocks.authState.refresh).not.toHaveBeenCalled();
    expect(mocks.guestState.syncWithServer).not.toHaveBeenCalled();

    mocks.guestState.workouts = [{ id: "guest-workout-1" }];
    mocks.guestState.hydrated = true;
    view.rerender(
      <MemoryRouter initialEntries={["/auth/complete"]}>
        <Routes>
          <Route
            path="/auth/complete"
            element={(
              <>
                <OAuthCallbackPage />
                <LocationProbe />
              </>
            )}
          />
          <Route
            path="/oauth/callback"
            element={(
              <>
                <OAuthCallbackPage />
                <LocationProbe />
              </>
            )}
          />
          <Route path="*" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(mocks.authState.refresh).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(mocks.guestState.syncWithServer).toHaveBeenCalledTimes(1);
    });
  });

  it("completes sign-in without starting sync when every kept workout is already claimed", async () => {
    mocks.guestState.workouts = [{ id: "guest-workout-1" }];
    mocks.guestState.syncClaimedWorkoutIds = ["guest-workout-1"];
    mocks.authState.refresh.mockImplementation(async () => {
      mocks.authState.user = { id: 1, email: "user@example.com" };
    });

    renderPostLoginRoute();

    expect(await screen.findByText("1 workout is kept on this device.")).toBeInTheDocument();
    expect(mocks.guestState.syncWithServer).not.toHaveBeenCalled();
  });

  it.each([
    [
      "every workout uploaded",
      [] as Array<{ id: string }>,
      makeSyncResult({ syncedWorkouts: 2 }),
      "Your data has been synced successfully",
    ],
    [
      "nothing uploaded",
      [{ id: "guest-workout-1" }, { id: "guest-workout-2" }],
      makeSyncResult({ deletedWorkoutIds: ["guest-workout-1", "guest-workout-2"] }),
      "2 workouts are kept on this device.",
    ],
    [
      "some workouts uploaded",
      [{ id: "guest-workout-2" }],
      makeSyncResult({ syncedWorkouts: 1, deletedWorkoutIds: ["guest-workout-2"] }),
      "Synced 1 workout. 1 workout is kept on this device.",
    ],
  ])(
    "describes the sync outcome when %s",
    async (_label, workoutsAfterSync, syncResult, expectedMessage) => {
      mocks.guestState.workouts = [
        { id: "guest-workout-1" },
        { id: "guest-workout-2" },
      ];
      mocks.authState.refresh.mockImplementation(async () => {
        mocks.authState.user = { id: 1, email: "user@example.com" };
      });
      mocks.guestState.syncWithServer.mockImplementation(async () => {
        mocks.guestState.workouts = workoutsAfterSync;
        return syncResult;
      });

      renderPostLoginRoute();

      await waitFor(() => {
        expect(screen.getByText("You're all set!")).toBeInTheDocument();
      });
      expect(screen.getByText(expectedMessage)).toBeInTheDocument();
    },
  );
});
