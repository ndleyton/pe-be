import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { render } from "@/test/testUtils";
import { makeRoutineSummary } from "@/test/fixtures";
import { RoutinesSection } from "./RoutinesSection";
import { getRoutines } from "@/features/routines/api";

const mockAuthState = {
  isAuthenticated: false,
};

const { preloadSpy } = vi.hoisted(() => ({
  preloadSpy: vi.fn(),
}));

vi.mock("@/features/routines/api", () => ({
  getRoutines: vi.fn(),
}));

vi.mock("@/shared/lib/createIntentPreload", () => ({
  createIntentPreload: vi.fn(() => preloadSpy),
}));

vi.mock("@/stores", () => ({
  useAuthStore: vi.fn((selector) =>
    selector ? selector(mockAuthState) : mockAuthState,
  ),
}));

vi.mock("@/features/routines/components", () => ({
  RoutineQuickStartCard: ({ routine }: { routine: { name: string } }) => (
    <div>{routine.name}</div>
  ),
}));

const mockGetRoutines = vi.mocked(getRoutines);

const routines = [
  makeRoutineSummary({
    id: 1,
    name: "Push Day",
    description: null,
    workout_type_id: 2,
    creator_id: 1,
    visibility: "public",
    is_readonly: true,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
  }),
];

describe("RoutinesSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetRoutines.mockResolvedValue({ data: routines, next_cursor: null });
  });

  it("auto-opens the routines list when requested", async () => {
    render(<RoutinesSection onStartWorkout={vi.fn()} autoOpen />);

    const trigger = await screen.findByRole("button", {
      name: /quick start routines/i,
    });

    await waitFor(() => {
      expect(trigger).toHaveAttribute("aria-expanded", "true");
    });
    expect(screen.getByText("Push Day")).toBeVisible();
  });

  it("stays collapsed by default while keeping the browse link visible", async () => {
    render(<RoutinesSection onStartWorkout={vi.fn()} />);

    const trigger = await screen.findByRole("button", {
      name: /quick start routines/i,
    });
    const browseLink = await screen.findByRole("link", {
      name: /browse all routines/i,
    });

    await waitFor(() => {
      expect(trigger).toHaveAttribute("aria-expanded", "false");
    });
    expect(browseLink).toBeVisible();
    expect(screen.getByText("Push Day")).not.toBeVisible();
  });

  it("preloads the routines page when the browse button shows intent", async () => {
    render(<RoutinesSection onStartWorkout={vi.fn()} />);

    const browseButton = await screen.findByRole("link", {
      name: /browse all routines/i,
    });

    fireEvent.mouseEnter(browseButton);
    fireEvent.touchStart(browseButton);
    fireEvent.focus(browseButton);

    expect(preloadSpy).toHaveBeenCalledTimes(3);
  });
});
