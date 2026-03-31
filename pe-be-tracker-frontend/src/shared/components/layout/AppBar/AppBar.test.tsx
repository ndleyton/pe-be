import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@/test/testUtils";
import userEvent from "@testing-library/user-event";
import AppBar from "./AppBar";

let mockAuthenticated = false;
let mockTimerStartTime: string | null = null;
let mockTimerPaused = false;
let mockFormattedTime = "0:00";
const mockToggleWorkoutTimer = vi.fn();

const mockToggleDrawer = vi.fn();
const mockGoogleSignIn = vi.fn();

vi.mock("@/stores", () => ({
  useAuthStore: vi.fn((selector) => {
    const state = {
      isAuthenticated: mockAuthenticated,
      initialized: true,
    };
    return selector ? selector(state) : state;
  }),
  useUIStore: vi.fn((selector) => {
    const state = {
      isDrawerOpen: false,
      workoutTimer: {
        startTime: mockTimerStartTime,
        elapsedSeconds: 0,
        paused: mockTimerPaused,
        intervalId: null,
      },
      toggleDrawer: mockToggleDrawer,
      openDrawer: vi.fn(),
      closeDrawer: vi.fn(),
      startWorkoutTimer: vi.fn(),
      pauseWorkoutTimer: vi.fn(),
      resumeWorkoutTimer: vi.fn(),
      toggleWorkoutTimer: mockToggleWorkoutTimer,
      stopWorkoutTimer: vi.fn(),
      getFormattedWorkoutTime: vi.fn(() => mockFormattedTime),
    };
    return selector ? selector(state) : state;
  }),
}));

vi.mock("@/features/auth/hooks", () => ({
  useGoogleSignIn: () => mockGoogleSignIn,
}));

vi.mock("../HomeLogo", () => ({
  default: () => <div data-testid="home-logo">PE Logo</div>,
}));

describe("AppBar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthenticated = false;
    mockTimerStartTime = null;
    mockTimerPaused = false;
    mockFormattedTime = "0:00";
  });

  it("renders the app bar banner and mobile navigation controls", () => {
    render(<AppBar />);

    expect(screen.getByRole("banner")).toHaveAttribute(
      "aria-label",
      "Primary navigation",
    );
    expect(
      screen.getByRole("button", { name: /open navigation menu/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /go to workouts/i })).toHaveAttribute(
      "href",
      "/workouts",
    );
  });

  it("toggles the drawer from the mobile menu button", async () => {
    const user = userEvent.setup();

    render(<AppBar />);

    await user.click(
      screen.getByRole("button", { name: /open navigation menu/i }),
    );

    expect(mockToggleDrawer).toHaveBeenCalledTimes(1);
  });

  it("does not render a duplicate page heading in the top bar", () => {
    render(<AppBar />);

    expect(
      screen.queryByRole("heading", { name: /workouts/i }),
    ).not.toBeInTheDocument();
  });

  it("shows sign in when the user is signed out", () => {
    render(<AppBar />);

    expect(screen.getByRole("button", { name: /sign in/i })).toBeInTheDocument();
  });

  it("hides sign in when the user is authenticated", () => {
    mockAuthenticated = true;

    render(<AppBar />);

    expect(
      screen.queryByRole("button", { name: /sign in/i }),
    ).not.toBeInTheDocument();
  });

  it("shows and toggles the workout timer", async () => {
    const user = userEvent.setup();
    mockAuthenticated = true;
    mockTimerStartTime = "2026-03-30T00:00:00Z";
    mockFormattedTime = "0:10";

    render(<AppBar />);

    const timerButton = screen.getByRole("button", { name: /pause timer/i });
    expect(screen.getByLabelText(/workout timer/i)).toHaveTextContent("0:10");

    await user.click(timerButton);

    expect(mockToggleWorkoutTimer).toHaveBeenCalledTimes(1);
  });
});
