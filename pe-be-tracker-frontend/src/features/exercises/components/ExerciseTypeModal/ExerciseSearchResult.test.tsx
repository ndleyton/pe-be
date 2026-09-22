import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  ExerciseSearchResult,
  ExerciseSearchResultSkeleton,
} from "./ExerciseSearchResult";
import { makeExerciseType, makeMuscle } from "@/test/fixtures";

describe("ExerciseSearchResult", () => {
  it("renders base name, variation, and muscles", () => {
    const onSelect = vi.fn();
    const exercise = makeExerciseType({
      name: "Barbell Bench Press - Close Grip",
      muscles: [
        makeMuscle({ id: 1, name: "Triceps" }),
        makeMuscle({ id: 2, name: "Chest" }),
      ],
    });

    render(
      <ExerciseSearchResult exerciseType={exercise} onSelect={onSelect} />,
    );

    expect(screen.getByText("Barbell Bench Press")).toBeInTheDocument();
    expect(screen.getByText("Close Grip")).toBeInTheDocument();
    expect(screen.getByText("Triceps")).toBeInTheDocument();
    expect(screen.getByText("Chest")).toBeInTheDocument();
  });

  it("calls onSelect when clicked", async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    const exercise = makeExerciseType({ name: "Squats" });

    render(
      <ExerciseSearchResult exerciseType={exercise} onSelect={onSelect} />,
    );

    await user.click(screen.getByRole("button", { name: "Squats" }));
    expect(onSelect).toHaveBeenCalledWith(exercise);
  });
});

describe("ExerciseSearchResultSkeleton", () => {
  it("renders skeleton placeholders matching the result layout", () => {
    const { container } = render(<ExerciseSearchResultSkeleton />);

    expect(
      screen.getByTestId("exercise-search-result-skeleton"),
    ).toBeInTheDocument();
    const skeletons = container.querySelectorAll('[data-slot="skeleton"]');
    expect(skeletons.length).toBeGreaterThan(0);
  });
});
