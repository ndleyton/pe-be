import { describe, expect, it, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { render } from "@/test/testUtils";
import ProfilePage from "./ProfilePage";
import { getMyWorkouts } from "@/features/workouts";
import { usePublicProfileSettings } from "@/features/profile/hooks/usePublicProfileSettings";
import { useAuthStore, useGuestStore } from "@/stores";

vi.mock("@/features/workouts", () => ({
  getMyWorkouts: vi.fn(),
}));

vi.mock("@/features/profile/hooks/usePublicProfileSettings", () => ({
  usePublicProfileSettings: vi.fn(),
}));

vi.mock("@/features/mcp/components/PersonalAccessTokensSettings", () => ({
  PersonalAccessTokensSettings: () => <div>PAT Settings Mock</div>,
}));

vi.mock("@/shared/components/WeekTracking", () => ({
  WeekTracking: () => <div data-testid="week-tracking">Week tracking mock</div>,
}));

vi.mock("@/stores", () => ({
  useAuthStore: vi.fn(),
  useGuestStore: vi.fn(),
}));

const mockAuthState = {
  isAuthenticated: true,
  user: { id: 1, email: "test@example.com" },
  loading: false,
  initialized: true,
};

const mockGuestState = {
  hydrated: true,
  workouts: [],
};

const mockGetMyWorkouts = vi.mocked(getMyWorkouts);
const mockUsePublicProfileSettings = vi.mocked(usePublicProfileSettings);
const mockUseAuthStore = vi.mocked(useAuthStore);
const mockUseGuestStore = vi.mocked(useGuestStore);

describe("ProfilePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockUseAuthStore.mockImplementation((selector: any) =>
      selector ? selector(mockAuthState) : mockAuthState,
    );

    mockUseGuestStore.mockImplementation((selector: any) =>
      selector ? selector(mockGuestState) : mockGuestState,
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

    mockGetMyWorkouts.mockResolvedValue({
      data: [
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
      ],
      next_cursor: null,
    });
  });

  it("renders skeletons for stats cards while workout data is loading", () => {
    // Return pending promise so query stays in loading state
    mockGetMyWorkouts.mockReturnValue(new Promise(() => {}));

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

  it("renders settled stats and public profile info once loaded", async () => {
    render(<ProfilePage />);

    await waitFor(() => {
      expect(screen.getAllByText("1")).toHaveLength(2); // Total Workouts and Completed
    });

    expect(screen.getByText("60")).toBeInTheDocument(); // 60 min average duration
    expect(screen.getByText("@lifter123")).toBeInTheDocument();
  });
});
