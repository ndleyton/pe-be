import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { render, screen } from "@/test/testUtils";
import { useAuthStore, useGuestStore, useUIStore } from "@/stores";
import userEvent from "@testing-library/user-event";
import AppLayout from "./AppLayout";

const MockComponent = () => <div>Mock Content</div>;

describe("AppLayout", () => {
  beforeEach(() => {
    sessionStorage.clear();
    useAuthStore.setState({
      user: null,
      loading: false,
      isAuthenticated: false,
      initialized: true,
    });
    useGuestStore.setState((state) => ({
      ...state,
      workouts: [],
      hydrated: true,
    }));
  });

  afterEach(() => {
    useUIStore.getState().stopWorkoutTimer();
  });

  it("should have skip to content link as first focusable element", async () => {
    const user = userEvent.setup();

    render(
      <>
        <AppLayout />
        <MockComponent />
      </>,
    );

    await user.tab();

    const skipLink = screen.getByRole("link", { name: /skip to content/i });
    expect(skipLink).toHaveFocus();
  });

  it("should open and close drawer with keyboard", async () => {
    const user = userEvent.setup();

    render(
      <>
        <AppLayout />
        <MockComponent />
      </>,
    );

    const hamburgerButton = screen.getByRole("button", {
      name: /open navigation menu/i,
    });
    await user.click(hamburgerButton);

    const drawer = screen.getByRole("dialog");
    expect(drawer).toBeInTheDocument();
    expect(drawer).toHaveAttribute("data-state", "open");

    await user.keyboard("{Escape}");

    expect(drawer).toHaveAttribute("data-state", "closed");
  });

  it("should have proper ARIA labels on navigation elements", () => {
    render(
      <>
        <AppLayout />
        <MockComponent />
      </>,
    );

    const banner = screen.getByRole("banner");
    expect(banner).toHaveAttribute("aria-label", "Primary navigation");

    const bottomNav = screen.getByRole("navigation", {
      name: /bottom navigation/i,
    });
    expect(bottomNav).toBeInTheDocument();
  });

  it("reserves a top banner slot while auth is unresolved", () => {
    useAuthStore.setState({
      user: null,
      loading: true,
      isAuthenticated: false,
      initialized: false,
    });

    render(
      <>
        <AppLayout />
        <MockComponent />
      </>,
    );

    const slot = screen.getByTestId("guest-mode-banner-slot");

    expect(slot).toHaveClass("min-h-[5.75rem]");
    expect(screen.queryByTestId("guest-mode-banner")).not.toBeInTheDocument();
  });

  it("shows the guest banner in the reserved slot for initialized guest sessions", () => {
    useGuestStore.setState((state) => ({
      ...state,
      workouts: [{ id: "guest-workout-1" }],
      hydrated: true,
    }));

    render(
      <>
        <AppLayout />
        <MockComponent />
      </>,
    );

    expect(screen.getByTestId("guest-mode-banner-slot")).toBeInTheDocument();
    expect(screen.getByTestId("guest-mode-banner")).toBeInTheDocument();
    expect(screen.getByText("1 Workout")).toBeInTheDocument();
  });
});
