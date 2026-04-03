import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { render } from "@/test/testUtils";
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
  {
    id: 1,
    name: "Push Day",
    description: null,
    workout_type_id: 2,
    creator_id: 1,
    visibility: "public" as const,
    is_readonly: true,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    exercise_templates: [],
  },
];

describe("RoutinesSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetRoutines.mockResolvedValue({ data: routines, next_cursor: null });
  });

  it("auto-opens the accordion when requested", async () => {
    render(<RoutinesSection onStartWorkout={vi.fn()} autoOpen />);

    const trigger = await screen.findByRole("button", {
      name: /quick start routines/i,
    });

    await waitFor(() => {
      expect(trigger).toHaveAttribute("aria-expanded", "true");
    });
  });

  it("stays collapsed by default", async () => {
    render(<RoutinesSection onStartWorkout={vi.fn()} />);

    const trigger = await screen.findByRole("button", {
      name: /quick start routines/i,
    });

    await waitFor(() => {
      expect(trigger).toHaveAttribute("aria-expanded", "false");
    });
  });

  it("preloads the routines page when the browse button shows intent", async () => {
    render(<RoutinesSection onStartWorkout={vi.fn()} />);

    await userEvent.click(
      await screen.findByRole("button", { name: /quick start routines/i }),
    );

    const browseButton = screen.getByRole("link", {
      name: /browse all routines/i,
    });

    fireEvent.mouseEnter(browseButton);
    fireEvent.touchStart(browseButton);
    fireEvent.focus(browseButton);

    expect(preloadSpy).toHaveBeenCalledTimes(3);
  });
});
