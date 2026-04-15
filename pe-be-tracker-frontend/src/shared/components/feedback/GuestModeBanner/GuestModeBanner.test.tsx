import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act, fireEvent } from "@/test/testUtils";
import GuestModeBanner from "./GuestModeBanner";

let mockAuthenticated = false;
let mockAuthLoading = false;
let mockAuthInitialized = true;
let mockWorkouts: any[] = [];

vi.mock("@/stores", () => ({
  useAuthStore: vi.fn((selector) => {
    const state = {
      isAuthenticated: mockAuthenticated,
      loading: mockAuthLoading,
      initialized: mockAuthInitialized,
    };
    return selector ? selector(state) : state;
  }),
  useGuestStore: vi.fn((selector) => {
    const state = {
      workouts: mockWorkouts,
    };
    return selector ? selector(state) : state;
  }),
}));

describe("GuestModeBanner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    sessionStorage.clear();
    mockAuthenticated = false;
    mockAuthLoading = false;
    mockAuthInitialized = true;
    mockWorkouts = [];
  });

  it("does not render when authenticated", () => {
    mockAuthenticated = true;
    render(<GuestModeBanner />);
    expect(screen.queryByText(/Guest Mode/i)).not.toBeInTheDocument();
  });

  it("does not render when auth is loading", () => {
    mockAuthLoading = true;
    render(<GuestModeBanner />);
    expect(screen.queryByText(/Guest Mode/i)).not.toBeInTheDocument();
  });

  it("renders after delay when guest and not loading", async () => {
    render(<GuestModeBanner />);

    // Initially not showing due to delay
    expect(screen.queryByText(/Guest Mode/i)).not.toBeInTheDocument();

    // Advance timers
    act(() => {
      vi.advanceTimersByTime(800);
    });

    expect(screen.getByText(/Guest Mode/i)).toBeInTheDocument();
  });

  it("shows workout count if guest has workouts", async () => {
    mockWorkouts = [{}, {}];
    render(<GuestModeBanner />);

    act(() => {
      vi.advanceTimersByTime(800);
    });

    expect(screen.getByText(/2 Workouts/i)).toBeInTheDocument();
  });

  it("dismisses and persists to sessionStorage when X is clicked", async () => {
    render(<GuestModeBanner />);

    act(() => {
      vi.advanceTimersByTime(800);
    });

    const closeButton = screen.getByRole("button", { name: /dismiss/i });
    fireEvent.click(closeButton);

    expect(screen.queryByText(/Guest Mode/i)).not.toBeInTheDocument();
    expect(sessionStorage.getItem("guest-mode-banner-dismissed")).toBe("true");
  });

  it("honors existing dismissal from sessionStorage on mount", async () => {
    sessionStorage.setItem("guest-mode-banner-dismissed", "true");
    render(<GuestModeBanner />);

    act(() => {
      vi.advanceTimersByTime(800);
    });

    expect(screen.queryByText(/Guest Mode/i)).not.toBeInTheDocument();
  });
});
