import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import ExerciseList from "./ExerciseList";

describe("ExerciseList", () => {
  it("renders structural skeletons while exercises are pending", () => {
    render(<ExerciseList exercises={[]} status="pending" />);

    expect(
      screen.getByRole("status", { name: /loading exercises/i }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/initializing workout/i)).not.toBeInTheDocument();
  });
});
