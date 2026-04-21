import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import { makeRoutineSummary } from "@/test/fixtures";
import { render } from "@/test/testUtils";
import { RoutineQuickStartCard } from "./RoutineQuickStartCard";

const { preloadSpy } = vi.hoisted(() => ({
  preloadSpy: vi.fn(),
}));

vi.mock("@/shared/lib/createIntentPreload", () => ({
  createIntentPreload: vi.fn(() => preloadSpy),
}));

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
    const routine = makeRoutineSummary({ id: 9, name: "Pull Day" });

    render(
      <RoutineQuickStartCard
        routine={routine}
        onStartWorkout={onStartWorkout}
      />,
    );

    await fireEvent.click(screen.getByRole("button", { name: /start workout/i }));

    expect(onStartWorkout).toHaveBeenCalledTimes(1);
    expect(onStartWorkout).toHaveBeenCalledWith(
      expect.objectContaining({ id: routine.id, name: routine.name }),
    );
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

  it("clamps long routine names so card height stays bounded on narrow layouts", () => {
    render(
      <RoutineQuickStartCard
        routine={makeRoutineSummary({
          name: "Very Long Upper Body Push and Pull Hybrid Session",
        })}
        onStartWorkout={vi.fn()}
      />,
    );

    expect(
      screen.getByText("Very Long Upper Body Push and Pull Hybrid Session"),
    ).toHaveClass("line-clamp-2");
  });
});
