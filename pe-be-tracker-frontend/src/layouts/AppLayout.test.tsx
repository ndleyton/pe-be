import { afterEach, describe, expect, it } from "vitest";
import { render, screen } from "@/test/testUtils";
import { useUIStore } from "@/stores";
import userEvent from "@testing-library/user-event";
import AppLayout from "./AppLayout";

const MockComponent = () => <div>Mock Content</div>;

describe("AppLayout", () => {
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
});
