import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import { render } from "@/test/testUtils";
import { makeExerciseType } from "@/test/fixtures";
import { ExerciseTypeCard } from "./ExerciseTypeCard";

const { preloadSpy } = vi.hoisted(() => ({
  preloadSpy: vi.fn(),
}));

vi.mock("@/shared/lib/createIntentPreload", () => ({
  createIntentPreload: vi.fn(() => preloadSpy),
}));

describe("ExerciseTypeCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("preloads the exercise type details page on hover, touch, and focus", () => {
    render(
      <ExerciseTypeCard
        exerciseType={makeExerciseType({ id: 12, name: "Bench Press" })}
      />,
    );

    const link = screen.getByRole("link", { name: /bench press/i });

    expect(link).toHaveAttribute("href", "/exercise-types/12");

    fireEvent.mouseEnter(link);
    fireEvent.touchStart(link);
    fireEvent.focus(link);

    expect(preloadSpy).toHaveBeenCalledTimes(3);
  });
});
