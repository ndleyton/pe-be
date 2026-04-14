import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@/test/testUtils";
import userEvent from "@testing-library/user-event";
import GuestModeBanner from "./GuestModeBanner";

const mocks = vi.hoisted(() => ({
  authState: {
    isAuthenticated: false,
    loading: false,
  },
  guestState: {
    workouts: [] as Array<{ id: string }>,
  },
}));

vi.mock("@/stores", () => ({
  useAuthStore: vi.fn((selector) => {
    const state = mocks.authState;
    return selector ? selector(state) : state;
  }),
  useGuestStore: vi.fn((selector) => {
    const state = mocks.guestState;
    return selector ? selector(state) : state;
  }),
}));

describe("GuestModeBanner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authState.isAuthenticated = false;
    mocks.authState.loading = false;
    mocks.guestState.workouts = [];
    sessionStorage.clear();
  });

  it("renders in the top layout flow instead of as a fixed overlay", () => {
    render(<GuestModeBanner />);

    const banner = screen.getByTestId("guest-mode-banner");

    expect(banner).toHaveClass("sticky", "top-16");
    expect(banner).not.toHaveClass("fixed");
    expect(screen.getByText(/guest mode/i)).toBeInTheDocument();
  });

  it("dismisses the banner for the current session", async () => {
    const user = userEvent.setup();

    render(<GuestModeBanner />);

    await user.click(screen.getByRole("button", { name: /dismiss banner/i }));

    expect(screen.queryByTestId("guest-mode-banner")).not.toBeInTheDocument();
    expect(sessionStorage.getItem("guest-mode-banner-dismissed")).toBe("true");
  });
});
