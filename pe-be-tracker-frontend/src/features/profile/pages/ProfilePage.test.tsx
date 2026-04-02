import axios from "axios";
import { create } from "zustand";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { render, screen, waitFor } from "@/test/testUtils";
import { useAuthStore, useGuestStore } from "@/stores";
import { makeGuestWorkout } from "@/test/fixtures/guestStore";
import { makeWorkout } from "@/test/fixtures/workouts";

import ProfilePage from "./ProfilePage";

const { getMyWorkouts } = vi.hoisted(() => ({
  getMyWorkouts: vi.fn(),
}));

vi.mock("@/features/workouts", () => ({
  getMyWorkouts,
}));

vi.mock("@/stores", () => {
  type AuthUser = {
    id: number;
    email: string;
    name?: string | null;
    is_superuser?: boolean;
  };

  type AuthState = {
    user: AuthUser | null;
    loading: boolean;
    isAuthenticated: boolean;
    initialized: boolean;
    refresh: () => Promise<void>;
    signOut: () => Promise<void>;
    setUser: (user: AuthUser | null) => void;
    setLoading: (loading: boolean) => void;
  };

  type GuestWorkout = ReturnType<typeof makeGuestWorkout>;
  type GuestState = {
    workouts: GuestWorkout[];
    hydrated: boolean;
  };

  const useAuthStore = create<AuthState>((set) => ({
    user: null,
    loading: false,
    isAuthenticated: false,
    initialized: true,
    refresh: async () => {},
    signOut: async () => {},
    setUser: (user) =>
      set({
        user,
        isAuthenticated: !!user,
      }),
    setLoading: (loading) => set({ loading }),
  }));

  const useGuestStore = create<GuestState>(() => ({
    workouts: [],
    hydrated: true,
  }));

  return {
    useAuthStore,
    useGuestStore,
  };
});

vi.mock("@/shared/components/theme/mode-toggle", () => ({
  ModeToggle: () => <div>Theme toggle</div>,
}));

vi.mock("@/shared/components/WeekTracking", () => ({
  WeekTracking: ({ workouts }: { workouts: Array<{ id: string | number }> }) => (
    <div data-testid="week-tracking">{workouts.length}</div>
  ),
}));

describe("ProfilePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    useAuthStore.setState({
      user: null,
      loading: false,
      isAuthenticated: false,
      initialized: true,
    });

    useGuestStore.setState({
      hydrated: true,
      workouts: [],
    });
  });

  it("shows an inline warning instead of replacing the page on server errors", async () => {
    getMyWorkouts.mockRejectedValue(new Error("backend unavailable"));

    useAuthStore.setState({
      user: { id: 1, email: "test@example.com" },
      isAuthenticated: true,
    });

    render(<ProfilePage />);

    expect(await screen.findByText("Profile")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText("Workout history unavailable")).toBeInTheDocument();
    });
    expect(
      screen.getByText(/account settings are still available/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Failed to load profile data"),
    ).not.toBeInTheDocument();
  });

  it("falls back to guest mode on auth errors", async () => {
    const authError = new axios.AxiosError(
      "Unauthorized",
      "ERR_BAD_REQUEST",
      undefined,
      undefined,
      {
        status: 401,
        statusText: "Unauthorized",
        headers: {},
        config: { headers: new axios.AxiosHeaders() },
        data: {},
      },
    );

    getMyWorkouts.mockRejectedValue(authError);

    useAuthStore.setState({
      user: { id: 1, email: "test@example.com" },
      isAuthenticated: true,
    });
    useGuestStore.setState({
      hydrated: true,
      workouts: [
        makeGuestWorkout({
          id: "guest-1",
          name: "Guest workout",
        }),
      ],
    });

    render(<ProfilePage />);

    await waitFor(() => {
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
    });

    expect(await screen.findByText("Guest Mode Active")).toBeInTheDocument();
    expect(screen.getByText("Guest Mode")).toBeInTheDocument();
    expect(screen.queryByText("Workout history unavailable")).not.toBeInTheDocument();
    expect(screen.getByTestId("week-tracking")).toHaveTextContent("1");
  });

  it("shows authenticated stats when workouts load successfully", async () => {
    getMyWorkouts.mockResolvedValue({
      data: [
        makeWorkout({
          id: 101,
          start_time: "2024-01-01T08:00:00Z",
          end_time: "2024-01-01T09:00:00Z",
        }),
      ],
    });

    useAuthStore.setState({
      user: { id: 1, email: "test@example.com" },
      isAuthenticated: true,
    });

    render(<ProfilePage />);

    expect(await screen.findByText("Signed In")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByTestId("week-tracking")).toHaveTextContent("1");
    });
    expect(screen.queryByText("Workout history unavailable")).not.toBeInTheDocument();
  });
});
