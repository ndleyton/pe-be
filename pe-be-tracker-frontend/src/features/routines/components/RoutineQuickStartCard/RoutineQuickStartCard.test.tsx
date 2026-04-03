import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import { render } from "@/test/testUtils";
import { makeRoutine } from "@/test/fixtures";
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
        routine={makeRoutine({ id: 7, name: "Push Day" })}
        onStartWorkout={vi.fn()}
      />,
    );

    const detailsLink = screen.getByRole("link", { name: /view details/i });

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
        routine={makeRoutine({ id: 9, name: "Pull Day" })}
        onStartWorkout={onStartWorkout}
      />,
    );

    await fireEvent.click(screen.getByRole("button", { name: /start workout/i }));

    expect(onStartWorkout).toHaveBeenCalledTimes(1);
  });
});
