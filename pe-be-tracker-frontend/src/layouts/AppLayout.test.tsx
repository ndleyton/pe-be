import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import AppLayout from "./AppLayout";
import { AuthProvider } from "@/contexts/AuthContext";
import { WorkoutTimerProvider } from "@/contexts/WorkoutTimerContext";

const MockComponent = () => <div>Mock Content</div>;

const renderWithProviders = (ui: React.ReactElement) => {
  return render(
    <MemoryRouter>
      <WorkoutTimerProvider>
        <AuthProvider>{ui}</AuthProvider>
      </WorkoutTimerProvider>
    </MemoryRouter>,
  );
};

describe("AppLayout", () => {
  it("should have skip to content link as first focusable element", async () => {
    const user = userEvent.setup();

    renderWithProviders(
      <>
        <AppLayout />
        <MockComponent />
      </>,
    );

    // Tab to the first focusable element
    await user.tab();

    // Should focus the skip link
    const skipLink = screen.getByRole("link", { name: /skip to content/i });
    expect(skipLink).toHaveFocus();
  });

  it("should open and close drawer with keyboard", async () => {
    const user = userEvent.setup();

    renderWithProviders(
      <>
        <AppLayout />
        <MockComponent />
      </>,
    );

    // Find and click the hamburger menu button
    const hamburgerButton = screen.getByRole("button", {
      name: /open navigation menu/i,
    });
    await user.click(hamburgerButton);

    // Drawer should be visible (translated in)
    const drawer = screen.getByRole("dialog");
    expect(drawer).toBeInTheDocument();
    expect(drawer).toHaveAttribute("data-state", "open");

    // Press Escape to close
    await user.keyboard("{Escape}");

    // Drawer should be hidden (translated out)
    expect(drawer).toHaveAttribute("data-state", "closed");
  });

  it("should have proper ARIA labels on navigation elements", () => {
    renderWithProviders(
      <>
        <AppLayout />
        <MockComponent />
      </>,
    );

    // Check AppBar has proper role and aria-label
    const banner = screen.getByRole("banner");
    expect(banner).toHaveAttribute("aria-label", "Primary navigation");

    // Check bottom navigation has proper role and aria-label
    const bottomNav = screen.getByRole("navigation", {
      name: /bottom navigation/i,
    });
    expect(bottomNav).toBeInTheDocument();
  });
});
