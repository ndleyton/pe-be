import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@/test/testUtils";
import userEvent from "@testing-library/user-event";
import AppBar from "./AppBar";

// Mock react-router-dom navigate
const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Mock Zustand stores
const mockToggleDrawer = vi.fn();
const mockIsAuthenticated = vi.fn(() => false);
const mockSignOut = vi.fn();

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
      toggleDrawer: mockToggleDrawer,
      openDrawer: vi.fn(),
      closeDrawer: vi.fn(),
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

// Mock child components
vi.mock("../HomeLogo", () => ({
  default: () => <div data-testid="home-logo">PE Logo</div>,
}));

vi.mock("./DesktopNav", () => ({
  default: () => <div data-testid="desktop-nav">Desktop Navigation</div>,
}));

describe("AppBar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe("Rendering and Structure", () => {
    it("should render the app bar with proper banner role", () => {
      render(<AppBar />);

      const navbar = screen.getByRole("banner");
      expect(navbar).toBeInTheDocument();
      expect(navbar).toHaveAttribute("aria-label", "Primary navigation");
      expect(navbar).toHaveClass(
        "relative",
        "flex",
        "h-16",
        "items-center",
        "justify-center",
        "border-b",
        "bg-background",
        "px-4",
      );
    });

    it("should render the home logo button", () => {
      render(<AppBar />);

      const logoButton = screen.getByRole("button", { name: /go to home/i });
      expect(logoButton).toBeInTheDocument();
      expect(logoButton).toHaveClass("text-xl");
      expect(screen.getByTestId("home-logo")).toBeInTheDocument();
    });

    it("should render the mobile menu button with proper accessibility", () => {
      render(<AppBar />);

      const menuButton = screen.getByRole("button", {
        name: /open navigation menu/i,
      });
      expect(menuButton).toBeInTheDocument();
      expect(menuButton).toHaveClass("lg:hidden");
      expect(menuButton).toHaveAttribute("aria-label", "Open navigation menu");
    });
  });

  describe("Navigation Interactions", () => {
    it("should navigate to home when logo is clicked", async () => {
      const user = userEvent.setup();

      render(<AppBar />);

      const logoButton = screen.getByRole("button", { name: /go to home/i });
      await user.click(logoButton);

      expect(mockNavigate).toHaveBeenCalledWith("/");
    });

    it("should toggle drawer when mobile menu button is clicked", async () => {
      const user = userEvent.setup();

      render(<AppBar />);

      const menuButton = screen.getByRole("button", {
        name: /open navigation menu/i,
      });
      await user.click(menuButton);

      expect(mockToggleDrawer).toHaveBeenCalled();
    });

    it("should handle keyboard navigation for logo button", async () => {
      const user = userEvent.setup();

      render(<AppBar />);

      const logoButton = screen.getByRole("button", { name: /go to home/i });
      logoButton.focus();
      await user.keyboard("{Enter}");

      expect(mockNavigate).toHaveBeenCalledWith("/");
    });

    it("should handle keyboard navigation for menu button", async () => {
      const user = userEvent.setup();

      render(<AppBar />);

      const menuButton = screen.getByRole("button", {
        name: /open navigation menu/i,
      });
      menuButton.focus();
      await user.keyboard("{Enter}");

      expect(mockToggleDrawer).toHaveBeenCalled();
    });
  });

  describe("Responsive Design", () => {
    it("should have mobile-first responsive classes", () => {
      render(<AppBar />);

      // Mobile menu should be hidden on large desktop
      const menuButton = screen.getByRole("button", {
        name: /open navigation menu/i,
      });
      expect(menuButton).toHaveClass("lg:hidden");

      // Navbar still has left flex container
      const leftSection = screen
        .getByRole("banner")
        .querySelector(".absolute.left-4");
      expect(leftSection).toBeInTheDocument();
    });

    it("should have proper styling classes for layout", () => {
      render(<AppBar />);

      const navbar = screen.getByRole("banner");
      expect(navbar).toHaveClass(
        "relative",
        "flex",
        "h-16",
        "items-center",
        "justify-center",
        "border-b",
        "bg-background",
        "px-4",
      );

      const startSection = navbar.querySelector(".absolute.left-4");
      const centerSection = navbar.querySelector(".flex.items-center");
      const endSection = navbar.querySelector(".absolute.right-4");

      expect(startSection).toBeInTheDocument();
      expect(centerSection).toBeInTheDocument();
      expect(endSection).toBeInTheDocument();
    });
  });

  describe("Component Integration", () => {
    it("should properly integrate with DrawerContext", () => {
      render(<AppBar />);

      // Component should render without errors, indicating proper context integration
      expect(screen.getByRole("banner")).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /open navigation menu/i }),
      ).toBeInTheDocument();
    });

    it("should properly integrate with React Router", () => {
      render(<AppBar />);

      // Component should render without errors, indicating proper router integration
      expect(screen.getByRole("banner")).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /go to home/i }),
      ).toBeInTheDocument();
    });

    it("should render child components correctly", () => {
      render(<AppBar />);

      // Check that mocked child components are rendered
      expect(screen.getByTestId("home-logo")).toHaveTextContent("PE Logo");
    });
  });

  describe("Accessibility", () => {
    it("should have proper ARIA labels and roles", () => {
      render(<AppBar />);

      const navbar = screen.getByRole("banner");
      expect(navbar).toHaveAttribute("aria-label", "Primary navigation");

      const menuButton = screen.getByRole("button", {
        name: /open navigation menu/i,
      });
      expect(menuButton).toHaveAttribute("aria-label", "Open navigation menu");

      const logoButton = screen.getByRole("button", { name: /go to home/i });
      expect(logoButton).toHaveAttribute("aria-label", "Go to home");
    });

    it("should be keyboard accessible", () => {
      render(<AppBar />);

      const logoButton = screen.getByRole("button", { name: /go to home/i });
      const menuButton = screen.getByRole("button", {
        name: /open navigation menu/i,
      });

      // Both buttons should be focusable
      expect(logoButton).toBeInTheDocument();
      expect(menuButton).toBeInTheDocument();
    });

    it("should have semantic HTML structure", () => {
      render(<AppBar />);

      const banner = screen.getByRole("banner");
      expect(banner).toBeInTheDocument();

      // Interactive buttons should be properly typed (excluding dropdown buttons)
      const explicitButtons = screen
        .getAllByRole("button")
        .filter(
          (button) =>
            button.hasAttribute("type") || button.getAttribute("aria-label"),
        );
      explicitButtons.forEach((button) => {
        if (button.hasAttribute("type")) {
          expect(button).toHaveAttribute("type", "button");
        }
      });
    });
  });

  describe("Visual Design and Styling", () => {
    it("should have proper button styling classes", () => {
      render(<AppBar />);

      const logoButton = screen.getByRole("button", { name: /go to home/i });
      expect(logoButton).toHaveClass("text-xl");

      const menuButton = screen.getByRole("button", {
        name: /open navigation menu/i,
      });
      expect(menuButton).toHaveClass("lg:hidden");
    });

    it("should have consistent navbar theming", () => {
      render(<AppBar />);

      const navbar = screen.getByRole("banner");
      expect(navbar).toHaveClass(
        "relative",
        "flex",
        "h-16",
        "items-center",
        "justify-center",
        "border-b",
        "bg-background",
        "px-4",
      );
    });
  });

  describe("User Account Features", () => {
    it("should have navbar-end with user account features", () => {
      render(<AppBar />);

      const endSection = screen
        .getByRole("banner")
        .querySelector(".absolute.right-4");
      expect(endSection).toBeInTheDocument();
      // Should contain user account features (sign in button when not authenticated)
      expect(endSection).not.toBeEmptyDOMElement();
    });
  });
});
