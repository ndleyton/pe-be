import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import WorkoutPageSkeleton from "./WorkoutPageSkeleton";

describe("WorkoutPageSkeleton", () => {
  it("renders exercise list skeletons by default", () => {
    const { container } = render(
      <MemoryRouter initialEntries={["/workouts/12"]}>
        <WorkoutPageSkeleton />
      </MemoryRouter>,
    );

    expect(screen.getByRole("status", { name: /loading workout/i })).toBeInTheDocument();
    expect(container.querySelectorAll("[data-slot='skeleton']").length).toBeGreaterThan(6);
  });

  it("skips multi-exercise skeletons when knownEmptyExercises is set", () => {
    const { container } = render(
      <MemoryRouter
        initialEntries={[
          { pathname: "/workouts/12", state: { knownEmptyExercises: true } },
        ]}
      >
        <WorkoutPageSkeleton />
      </MemoryRouter>,
    );

    expect(screen.getByRole("status", { name: /loading workout/i })).toBeInTheDocument();
    expect(container.querySelectorAll("[data-slot='skeleton']").length).toBe(6);
  });
});
