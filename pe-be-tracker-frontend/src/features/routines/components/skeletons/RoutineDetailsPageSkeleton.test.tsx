import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";

import { render } from "@/test/testUtils";

import { RoutineDetailsPageSkeleton } from "./RoutineDetailsPageSkeleton";

describe("RoutineDetailsPageSkeleton", () => {
  it("models the read-only view mode the details page opens in", () => {
    const { container } = render(<RoutineDetailsPageSkeleton />);

    expect(screen.getByText("Exercise Sequence")).toBeInTheDocument();
    // View mode has no per-set input grids or "Add Set" buttons.
    expect(container.querySelector(".md\\:grid-cols-3")).not.toBeInTheDocument();
    expect(
      container.querySelectorAll('[data-slot="skeleton"].h-10.w-full'),
    ).toHaveLength(6);
  });
});
