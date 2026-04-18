import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@/test/testUtils";
import { within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import DesktopSidebar from "./DesktopSidebar";

vi.mock("../FirstWorkoutCTA", () => ({
  default: () => <div data-testid="first-workout-cta" />,
}));

// Mock Zustand stores
const mockSignOut = vi.fn();
const mockIsAuthenticated = vi.fn(() => false);
vi.mock("@/stores", () => ({
  useAuthStore: vi.fn((selector) => {
    const state = {
      isAuthenticated: mockIsAuthenticated(),
      signOut: mockSignOut,
      user: null,
      initialized: true,
    };
    return selector ? selector(state) : state;
  }),
  useUIStore: vi.fn((selector) => {
    const state = {
      isDrawerOpen: false,
      workoutTimer: {
        startTime: null,
        elapsedSeconds: 0,
        paused: false,
        intervalId: null,
      },
      openDrawer: vi.fn(),
      closeDrawer: vi.fn(),
      toggleDrawer: vi.fn(),
      startWorkoutTimer: vi.fn(),
      pauseWorkoutTimer: vi.fn(),
      resumeWorkoutTimer: vi.fn(),
      toggleWorkoutTimer: vi.fn(),
      stopWorkoutTimer: vi.fn(),
      getFormattedWorkoutTime: vi.fn(() => "0:00"),
    };
    return selector ? selector(state) : state;
  }),
}));

// Mock API client
vi.mock("@/shared/api/client", () => ({
  default: {
    get: vi.fn(),
  },
}));

describe("DesktopSidebar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsAuthenticated.mockReturnValue(false);
  });

  describe("Rendering and Structure", () => {
    it("should render the desktop sidebar with proper structure", () => {
      render(<DesktopSidebar />);

      const sidebar = screen.getByRole("complementary");
      expect(sidebar).toBeInTheDocument();
      expect(sidebar).toHaveClass(
        "hidden",
        "lg:flex",
        "lg:flex-col",
        "lg:w-64",
        "lg:fixed",
      );
    });

    it("should render the brand logo and title", () => {
      render(<DesktopSidebar />);

      expect(screen.getByTestId("home-logo")).toBeInTheDocument();
      expect(
        screen.getByRole("link", { name: /go to workouts/i }),
      ).toHaveAttribute("href", "/workouts");
    });

    it("should render all navigation items", () => {
      render(<DesktopSidebar />);

      const nav = screen.getByRole("navigation", { name: /sidebar navigation/i });

      expect(
        within(nav).getByRole("link", { name: /^workouts$/i }),
      ).toBeInTheDocument();
      expect(
        within(nav).getByRole("link", { name: /routines/i }),
      ).toBeInTheDocument();
      expect(
        within(nav).getByRole("link", { name: /exercises/i }),
      ).toBeInTheDocument();
      expect(
        within(nav).getByRole("link", { name: /profile/i }),
      ).toBeInTheDocument();
      expect(within(nav).getByRole("link", { name: /chat/i })).toBeInTheDocument();
    });

    it("should have correct href attributes for navigation links", () => {
      render(<DesktopSidebar />);
      const nav = screen.getByRole("navigation", { name: /sidebar navigation/i });

      expect(within(nav).getByRole("link", { name: /^workouts$/i })).toHaveAttribute(
        "href",
        "/workouts",
      );
      expect(within(nav).getByRole("link", { name: /routines/i })).toHaveAttribute(
        "href",
        "/routines",
      );
      expect(within(nav).getByRole("link", { name: /exercises/i })).toHaveAttribute(
        "href",
        "/exercise-types",
      );
      expect(within(nav).getByRole("link", { name: /profile/i })).toHaveAttribute(
        "href",
        "/profile",
      );
      expect(within(nav).getByRole("link", { name: /chat/i })).toHaveAttribute(
        "href",
        "/chat",
      );
    });
  });

  describe("Authentication States", () => {
    it("should show sign in button when not authenticated", () => {
      mockIsAuthenticated.mockReturnValue(false);

      render(<DesktopSidebar />);

      expect(
        screen.getByRole("button", { name: /sign in with google/i }),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /about/i }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /sign out/i }),
      ).not.toBeInTheDocument();
    });

    it("should show about and sign out buttons when authenticated", () => {
      mockIsAuthenticated.mockReturnValue(true);

      render(<DesktopSidebar />);

      expect(
        screen.getByRole("button", { name: /about/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /sign out/i }),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /sign in with google/i }),
      ).not.toBeInTheDocument();
    });
  });

  describe("Accessibility", () => {
    it("should have proper ARIA labels and roles", () => {
      render(<DesktopSidebar />);

      const sidebar = screen.getByRole("complementary");
      expect(sidebar).toBeInTheDocument();

      const nav = screen.getByRole("navigation");
      expect(nav).toBeInTheDocument();
      expect(nav).toHaveAttribute("aria-label", "Sidebar navigation");
    });

    it("should be keyboard navigable", async () => {
      const user = userEvent.setup();

      render(<DesktopSidebar />);

      await user.tab();
      expect(screen.getByRole("link", { name: /go to workouts/i })).toHaveFocus();

      await user.tab();
      expect(screen.getByRole("link", { name: /^workouts$/i })).toHaveFocus();

      await user.tab();
      expect(screen.getByRole("link", { name: /routines/i })).toHaveFocus();

      await user.tab();
      expect(screen.getByRole("link", { name: /exercises/i })).toHaveFocus();

      await user.tab();
      expect(screen.getByRole("link", { name: /chat/i })).toHaveFocus();

      await user.tab();
      expect(screen.getByRole("link", { name: /profile/i })).toHaveFocus();
    });

    it("should have proper semantic structure", () => {
      render(<DesktopSidebar />);

      // Should have semantic aside element
      const sidebar = screen.getByRole("complementary");
      expect(sidebar.tagName).toBe("ASIDE");

      // Should have semantic nav element
      const nav = screen.getByRole("navigation");
      expect(nav.tagName).toBe("NAV");
    });
  });

  describe("Visual Design", () => {
    it("should have consistent styling classes", () => {
      render(<DesktopSidebar />);

      const sidebar = screen.getByRole("complementary");
      expect(sidebar).toHaveClass(
        "hidden",
        "lg:flex",
        "lg:flex-col",
        "lg:w-64",
        "lg:fixed",
        "lg:inset-y-0",
        "lg:left-0",
        "lg:bg-background",
        "lg:border-r",
      );
    });

    it("should have proper spacing and layout classes", () => {
      render(<DesktopSidebar />);

      const nav = screen.getByRole("navigation");
      expect(nav).toHaveClass("flex-1", "px-4", "py-6", "space-y-2");
    });
  });

  describe("Responsive Design", () => {
    it("should be hidden on smaller screens and visible on desktop", () => {
      render(<DesktopSidebar />);

      const sidebar = screen.getByRole("complementary");
      expect(sidebar).toHaveClass("hidden", "lg:flex");
    });
  });

  describe("Brand Display", () => {
    it("should display the brand correctly", () => {
      render(<DesktopSidebar />);

      expect(screen.getByTestId("home-logo")).toBeInTheDocument();
    });
  });
});
