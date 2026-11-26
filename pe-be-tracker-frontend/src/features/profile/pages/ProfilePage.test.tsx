import { describe, expect, it, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { render } from "@/test/testUtils";
import ProfilePage from "./ProfilePage";
import { useMyWorkoutsData } from "@/features/workouts";
import { usePublicProfileSettings } from "@/features/profile/hooks/usePublicProfileSettings";
import { useAuthStore } from "@/stores";

vi.mock("@/features/workouts", () => ({
  useMyWorkoutsData: vi.fn(),
}));

vi.mock("@/features/profile/hooks/usePublicProfileSettings", () => ({
  usePublicProfileSettings: vi.fn(),
}));

const mockPatSettings = vi.fn(({ enabled }: { enabled: boolean }) => (
  <div data-testid="pat-settings" data-enabled={String(enabled)}>
    PAT Settings Mock
  </div>
));

vi.mock("@/features/mcp/components/PersonalAccessTokensSettings", () => ({
  PersonalAccessTokensSettings: (props: { enabled: boolean }) =>
    mockPatSettings(props),
}));

vi.mock("@/shared/components/WeekTracking", () => ({
  WeekTracking: () => <div data-testid="week-tracking">Week tracking mock</div>,
}));

vi.mock("@/stores", () => ({
  useAuthStore: vi.fn(),
}));

const mockAuthState = {
  isAuthenticated: true,
  user: { id: 1, email: "test@example.com" },
  loading: false,
  initialized: true,
  hasSessionHint: true,
};

const mockUseMyWorkoutsData = vi.mocked(useMyWorkoutsData);
const mockUsePublicProfileSettings = vi.mocked(usePublicProfileSettings);
const mockUseAuthStore = vi.mocked(useAuthStore);

const defaultWorkouts = [
  {
    id: 1,
    name: "Leg Day",
    notes: "",
    start_time: "2026-01-01T10:00:00Z",
    end_time: "2026-01-01T11:00:00Z",
    workout_type_id: 1,
    created_at: "2026-01-01T10:00:00Z",
    updated_at: "2026-01-01T11:00:00Z",
  },
];

describe("ProfilePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthState.loading = false;
    mockAuthState.initialized = true;
    mockAuthState.isAuthenticated = true;
    mockAuthState.hasSessionHint = true;

    mockUseAuthStore.mockImplementation((selector: any) =>
      selector ? selector(mockAuthState) : mockAuthState,
    );

    mockUsePublicProfileSettings.mockReturnValue({
      createProfile: vi.fn(),
      error: null,
      errorMessage: null,
      isLoading: false,
      isPending: false,
      profile: {
        username: "lifter123",
        is_profile_public: true,
      },
      setUsernameFocused: vi.fn(),
      setUsername: vi.fn(),
      toggleVisibility: vi.fn(),
      username: "lifter123",
    });

    mockUseMyWorkoutsData.mockReturnValue({
      workouts: defaultWorkouts,
      activeWorkout: null,
      hasLoadedWorkouts: true,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
      isAuthenticated: true,
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
    });
  });

  it("waits for the session before showing guest account information", () => {
    mockAuthState.initialized = false;
    mockAuthState.loading = true;
    mockAuthState.isAuthenticated = false;
    mockAuthState.hasSessionHint = false;
    render(<ProfilePage />);
    expect(screen.getByText("Checking your session...")).toBeVisible();
    expect(screen.queryByText(/Guest Mode \(Stored Locally\)/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Unlock More With Sign-In/)).not.toBeInTheDocument();
    expect(mockUsePublicProfileSettings).toHaveBeenCalledWith(false);
    expect(screen.getByTestId("pat-settings")).toHaveAttribute("data-enabled", "false");
  });

  it("keeps signed-in-only settings disabled until auth resolves even with a stale session hint", () => {
    mockAuthState.initialized = false;
    mockAuthState.loading = true;
    mockAuthState.isAuthenticated = false;
    mockAuthState.hasSessionHint = true;
    render(<ProfilePage />);
    expect(mockUsePublicProfileSettings).toHaveBeenCalledWith(false);
    expect(screen.getByTestId("pat-settings")).toHaveAttribute("data-enabled", "false");
  });

  it("keeps account information during a later session refresh", () => {
    // useAuthStore.refresh sets loading=true again after the first check.
    mockAuthState.loading = true;
    render(<ProfilePage />);
    expect(screen.getByText("Authenticated Session")).toBeVisible();
    expect(screen.queryByText("Checking your session...")).not.toBeInTheDocument();
    expect(mockUsePublicProfileSettings).toHaveBeenCalledWith(true);
    expect(screen.getByTestId("pat-settings")).toHaveAttribute("data-enabled", "true");
  });

  it("renders skeletons for stats cards while workout data is loading", () => {
    mockUseMyWorkoutsData.mockReturnValue({
      workouts: [],
      activeWorkout: null,
      hasLoadedWorkouts: false,
      isLoading: true,
      error: null,
      refetch: vi.fn(),
      isAuthenticated: true,
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
    });

    const { container } = render(<ProfilePage />);

    // Total Workouts, Completed, and Avg Duration numbers should NOT be 0
    expect(screen.queryByText("0")).not.toBeInTheDocument();

    // Stats section should have aria-busy
    const statsContainer = container.querySelector("[aria-busy='true']");
    expect(statsContainer).toBeInTheDocument();
  });

  it("renders skeletons when public profile settings are loading", () => {
    mockUsePublicProfileSettings.mockReturnValue({
      createProfile: vi.fn(),
      error: null,
      errorMessage: null,
      isLoading: true,
      isPending: false,
      profile: undefined,
      setUsernameFocused: vi.fn(),
      setUsername: vi.fn(),
      toggleVisibility: vi.fn(),
      username: "",
    });

    render(<ProfilePage />);

    expect(
      screen.queryByText("Loading public profile settings..."),
    ).not.toBeInTheDocument();
    expect(
      screen.getByLabelText("Loading public profile settings"),
    ).toBeInTheDocument();
  });

  it("keeps account settings visible when workout statistics fail to load", () => {
    mockUseMyWorkoutsData.mockReturnValue({
      ...mockUseMyWorkoutsData(),
      error: new Error("next page failed"),
    });

    render(<ProfilePage />);

    expect(screen.getByText("Failed to load workout statistics")).toBeInTheDocument();
    expect(screen.getAllByText("1")).toHaveLength(2); // stats from loaded workouts
    expect(screen.getByText("@lifter123")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /dark/i })).toBeInTheDocument();
    expect(screen.getByTestId("pat-settings")).toHaveAttribute("data-enabled", "true");
  });

  it("renders settled stats and public profile info once loaded", () => {
    render(<ProfilePage />);

    expect(screen.getAllByText("1")).toHaveLength(2); // Total Workouts and Completed
    expect(screen.getByText("60")).toBeInTheDocument(); // 60 min average duration
    expect(screen.getByText("@lifter123")).toBeInTheDocument();
  });
});
