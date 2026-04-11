import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@/test/testUtils";
import userEvent from "@testing-library/user-event";
import SideDrawer from "./SideDrawer";
import api from "@/shared/api/client";

// Mock the API client
vi.mock("@/shared/api/client", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

// Use deep mock so nested functions like `get` & `post` have jest-style helpers (mockRejectedValue, etc.)
const mockApi = vi.mocked(api, { deep: true });

// Mock window.location.href
let mockLocationHref = "";
const mockLocation = {
  get href() {
    return mockLocationHref;
  },
  set href(value) {
    mockLocationHref = value;
  },
  assign: vi.fn(),
  reload: vi.fn(),
  replace: vi.fn(),
};

Object.defineProperty(window, "location", {
  value: mockLocation,
  writable: true,
});

// Mock Zustand stores
const mockCloseDrawer = vi.fn();
const mockOpenDrawer = vi.fn();
const mockToggleDrawer = vi.fn();
const mockIsAuthenticated = vi.fn(() => false);
const mockSignOut = vi.fn();
let mockIsOpen = true;

vi.mock("@/stores", () => ({
  useUIStore: vi.fn((selector) => {
    const state = {
      isDrawerOpen: mockIsOpen,
      workoutTimer: {
        startTime: null,
        elapsedSeconds: 0,
        paused: false,
        intervalId: null,
      },
      openDrawer: mockOpenDrawer,
      closeDrawer: mockCloseDrawer,
      toggleDrawer: mockToggleDrawer,
      startWorkoutTimer: vi.fn(),
      pauseWorkoutTimer: vi.fn(),
      resumeWorkoutTimer: vi.fn(),
      toggleWorkoutTimer: vi.fn(),
      stopWorkoutTimer: vi.fn(),
      getFormattedWorkoutTime: vi.fn(() => "0:00"),
    };
    return selector ? selector(state) : state;
  }),
  useAuthStore: vi.fn((selector) => {
    const state = {
      isAuthenticated: mockIsAuthenticated(),
      signOut: mockSignOut,
      user: null,
      initialized: true,
    };
    return selector ? selector(state) : state;
  }),
}));

// Test wrapper with required providers
const TestWrapper = ({ children }: { children: React.ReactNode }) => <>{children}</>;

describe("SideDrawer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLocationHref = "";
    mockIsOpen = true; // Default to open for most tests
    mockIsAuthenticated.mockReturnValue(false); // Default to non-authenticated
    // Mock API to not be authenticated by default
    mockApi.get.mockRejectedValue(new Error("Unauthorized"));
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe("Rendering and Basic Structure", () => {
    it("should always render drawer elements", () => {
      render(<SideDrawer />);

      // Drawer content should always be in DOM
      expect(screen.getByText("Menu")).toBeInTheDocument();
      expect(screen.getByRole("navigation")).toBeInTheDocument();
    });

    it("should show drawer when open", () => {
      mockIsOpen = true;

      render(<SideDrawer />);

      const drawer = screen.getByRole("dialog");
      expect(drawer).toBeInTheDocument();

      // Check drawer is open
      expect(drawer).toHaveAttribute("data-state", "open");
    });

    it("should hide drawer when closed", () => {
      mockIsOpen = false;

      render(<SideDrawer />);

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("should have proper ARIA attributes for accessibility", () => {
      render(<SideDrawer />);

      expect(screen.getByRole("navigation")).toHaveAttribute(
        "aria-label",
        "Secondary navigation",
      );
    });

    it("should have smooth animation classes", () => {
      render(<SideDrawer />);

      const drawer = screen.getByRole("dialog");
      expect(drawer).toHaveClass(
        "transition",
        "ease-in-out",
        "data-[state=closed]:duration-300",
        "data-[state=open]:duration-500",
      );
    });
  });

  describe("Navigation Links", () => {
    it("should render all navigation links", () => {
      render(<SideDrawer />);

      expect(
        screen.getByRole("link", { name: /workouts/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("link", { name: /routines/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("link", { name: /exercises/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("link", { name: /profile/i }),
      ).toBeInTheDocument();
      expect(screen.getByRole("link", { name: /chat/i })).toBeInTheDocument();
    });

    it("should have correct href attributes", () => {
      render(<SideDrawer />);

      expect(screen.getByRole("link", { name: /workouts/i })).toHaveAttribute(
        "href",
        "/workouts",
      );
      expect(screen.getByRole("link", { name: /routines/i })).toHaveAttribute(
        "href",
        "/routines",
      );
      expect(screen.getByRole("link", { name: /exercises/i })).toHaveAttribute(
        "href",
        "/exercise-types",
      );
      expect(screen.getByRole("link", { name: /profile/i })).toHaveAttribute(
        "href",
        "/profile",
      );
      expect(screen.getByRole("link", { name: /chat/i })).toHaveAttribute(
        "href",
        "/chat",
      );
    });

    it("should close drawer when navigation link is clicked", async () => {
      const user = userEvent.setup();

      render(<SideDrawer />);

      await user.click(screen.getByRole("link", { name: /workouts/i }));

      expect(mockCloseDrawer).toHaveBeenCalled();
    });
  });

  describe("Click Outside Interaction", () => {
    it("should close drawer when clicking outside drawer area", async () => {
      const user = userEvent.setup();

      render(<SideDrawer />);

      // Click outside the drawer (on the SheetOverlay)
      const overlay = screen.getByTestId("sheet-overlay");
      await user.click(overlay);

      expect(mockCloseDrawer).toHaveBeenCalled();
    });

    it("should not close drawer when clicking on drawer content", async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <SideDrawer />
        </TestWrapper>,
      );

      const drawerContent = screen.getByText("Menu");
      await user.click(drawerContent);

      expect(mockCloseDrawer).not.toHaveBeenCalled();
    });
  });

  describe("Authentication States", () => {
    it("should show Google sign-in button when not authenticated", async () => {
      // API returns unauthorized (not authenticated)
      mockApi.get.mockRejectedValueOnce(new Error("Unauthorized"));

      render(
        <TestWrapper>
          <SideDrawer />
        </TestWrapper>,
      );

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /sign in with google/i }),
        ).toBeInTheDocument();
      });

      expect(
        screen.queryByRole("button", { name: /sign out/i }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /about/i }),
      ).not.toBeInTheDocument();
    });

    it("should show About and Sign Out buttons when authenticated", async () => {
      // Set authenticated state
      mockIsAuthenticated.mockReturnValue(true);

      // API returns user (authenticated)
      mockApi.get.mockResolvedValueOnce({
        data: { id: 1, email: "test@example.com", name: "Test User" },
      });

      render(
        <TestWrapper>
          <SideDrawer />
        </TestWrapper>,
      );

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /about/i }),
        ).toBeInTheDocument();
        expect(
          screen.getByRole("button", { name: /sign out/i }),
        ).toBeInTheDocument();
      });

      expect(
        screen.queryByRole("button", { name: /sign in with google/i }),
      ).not.toBeInTheDocument();
    });
  });

  describe("Google Sign-In", () => {
    it("should handle Google sign-in flow", async () => {
      const user = userEvent.setup();

      // Clear the default rejection and mock successful OAuth response
      mockApi.get.mockReset();
      mockApi.get.mockResolvedValue({
        data: {
          authorization_url: "https://accounts.google.com/oauth/authorize",
        },
      });

      render(
        <TestWrapper>
          <SideDrawer />
        </TestWrapper>,
      );

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /sign in with google/i }),
        ).toBeInTheDocument();
      });

      await user.click(
        screen.getByRole("button", { name: /sign in with google/i }),
      );

      await waitFor(() => {
        expect(mockApi.get).toHaveBeenCalledWith("/auth/google/authorize");
        expect(mockLocationHref).toBe(
          "https://accounts.google.com/oauth/authorize",
        );
      });
    });

    it("should handle Google sign-in failure gracefully", async () => {
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => { });
      const user = userEvent.setup();

      // Clear the default rejection and set specific failure
      mockApi.get.mockReset();
      mockApi.get.mockRejectedValue(new Error("Network error"));

      render(
        <TestWrapper>
          <SideDrawer />
        </TestWrapper>,
      );

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /sign in with google/i }),
        ).toBeInTheDocument();
      });

      await user.click(
        screen.getByRole("button", { name: /sign in with google/i }),
      );

      expect(consoleSpy).toHaveBeenCalledWith(
        "Google sign-in failed",
        expect.any(Error),
      );
      expect(mockLocationHref).toBe("");

      consoleSpy.mockRestore();
    });
  });

  describe("Sign Out", () => {
    it("should handle sign out and close drawer", async () => {
      const user = userEvent.setup();

      // Set authenticated state
      mockIsAuthenticated.mockReturnValue(true);

      // Setup authenticated state
      mockApi.get.mockResolvedValueOnce({
        data: { id: 1, email: "test@example.com", name: "Test User" },
      });
      mockApi.post.mockResolvedValueOnce({});

      render(
        <TestWrapper>
          <SideDrawer />
        </TestWrapper>,
      );

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /sign out/i }),
        ).toBeInTheDocument();
      });

      await user.click(screen.getByRole("button", { name: /sign out/i }));

      expect(mockCloseDrawer).toHaveBeenCalled();
    });
  });

  describe("Keyboard Navigation", () => {
    it("should close drawer when Escape key is pressed", () => {
      render(
        <TestWrapper>
          <SideDrawer />
        </TestWrapper>,
      );

      fireEvent.keyDown(document, { key: "Escape", code: "Escape" });

      expect(mockCloseDrawer).toHaveBeenCalled();
    });

    it("should focus first navigation link when drawer opens", () => {
      // Ensure non-authenticated state for this test
      mockIsAuthenticated.mockReturnValue(false);

      render(
        <TestWrapper>
          <SideDrawer />
        </TestWrapper>,
      );

      const signInButton = screen.getByRole("button", {
        name: /sign in with google/i,
      });
      expect(signInButton).toHaveFocus();
    });

    it("should not close drawer when other keys are pressed", () => {
      render(
        <TestWrapper>
          <SideDrawer />
        </TestWrapper>,
      );

      fireEvent.keyDown(document, { key: "Enter", code: "Enter" });
      fireEvent.keyDown(document, { key: "Space", code: "Space" });

      expect(mockCloseDrawer).not.toHaveBeenCalled();
    });
  });

  describe("Responsive Design", () => {
    it("should have proper z-index stacking", () => {
      render(
        <TestWrapper>
          <SideDrawer />
        </TestWrapper>,
      );

      const drawer = screen.getByRole("dialog");

      expect(drawer).toHaveClass("z-[120]");
    });
  });
});
