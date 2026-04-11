import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import type { RoutineSummary } from "@/features/routines/types";
import { render } from "@/test/testUtils";
import { RoutineQuickStartCard } from "./RoutineQuickStartCard";

const { preloadSpy } = vi.hoisted(() => ({
  preloadSpy: vi.fn(),
}));

vi.mock("@/shared/lib/createIntentPreload", () => ({
  createIntentPreload: vi.fn(() => preloadSpy),
}));

const makeRoutineSummary = (
  overrides: Partial<RoutineSummary> = {},
): RoutineSummary => ({
  id: 1,
  name: "Test Routine",
  description: "A test routine",
  workout_type_id: 1,
  creator_id: 1,
  visibility: "private",
  is_readonly: false,
  created_at: "2024-01-01T10:00:00Z",
  updated_at: "2024-01-01T10:00:00Z",
  exercise_count: 3,
  set_count: 9,
  exercise_names_preview: ["Push-ups", "Rows", "Squats"],
  ...overrides,
});

describe("RoutineQuickStartCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("preloads the routine details page when details intent is detected", () => {
    render(
      <RoutineQuickStartCard
        routine={makeRoutineSummary({ id: 7, name: "Push Day" })}
        onStartWorkout={vi.fn()}
      />,
    );

    const detailsLink = screen.getByRole("link", { name: /details/i });

    expect(detailsLink).toHaveAttribute("href", "/routines/7");

    fireEvent.mouseEnter(detailsLink);
    fireEvent.touchStart(detailsLink);
    fireEvent.focus(detailsLink);

    expect(preloadSpy).toHaveBeenCalledTimes(3);
  });

  it("still starts a workout from the primary action", async () => {
    const onStartWorkout = vi.fn();

    render(
      <RoutineQuickStartCard
        routine={makeRoutineSummary({ id: 9, name: "Pull Day" })}
        onStartWorkout={onStartWorkout}
      />,
    );

    await fireEvent.click(screen.getByRole("button", { name: /start workout/i }));

    expect(onStartWorkout).toHaveBeenCalledTimes(1);
  });

  it("shows the backend-truncated remainder count from exercise_count", () => {
    render(
      <RoutineQuickStartCard
        routine={makeRoutineSummary({
          exercise_count: 8,
          exercise_names_preview: ["Push-ups", "Rows", "Squats"],
        })}
        onStartWorkout={vi.fn()}
      />,
    );

    expect(screen.getByText("+5 more")).toBeInTheDocument();
  });
});
