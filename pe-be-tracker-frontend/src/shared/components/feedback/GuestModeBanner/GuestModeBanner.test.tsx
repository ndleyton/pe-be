import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@/test/testUtils";
import userEvent from "@testing-library/user-event";
import GuestModeBanner from "./GuestModeBanner";

describe("GuestModeBanner", () => {
  const onDismiss = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the guest banner content in the reserved slot", () => {
    render(<GuestModeBanner workoutCount={2} onDismiss={onDismiss} />);

    const banner = screen.getByTestId("guest-mode-banner");

    expect(banner).toHaveClass("px-4", "pt-3");
    expect(banner).not.toHaveClass("fixed");
    expect(screen.getByText("2 Workouts")).toBeInTheDocument();
    expect(screen.getByText(/guest mode/i)).toBeInTheDocument();
  });

  it("calls dismiss when the close button is pressed", async () => {
    const user = userEvent.setup();

    render(<GuestModeBanner onDismiss={onDismiss} />);

    await user.click(screen.getByRole("button", { name: /dismiss banner/i }));

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
