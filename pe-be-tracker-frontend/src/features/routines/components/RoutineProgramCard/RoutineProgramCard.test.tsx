import { describe, expect, it } from "vitest";

import { makeRoutineProgramSummary } from "@/test/fixtures";
import { render, screen } from "@/test/testUtils";

import { RoutineProgramCard } from "./RoutineProgramCard";

describe("RoutineProgramCard", () => {
  it("uses the whole card as the program link", () => {
    render(
      <RoutineProgramCard
        program={makeRoutineProgramSummary({
          id: 42,
          name: "Upper Lower Split",
        })}
      />,
    );

    expect(
      screen.getByRole("link", { name: /open program upper lower split/i }),
    ).toHaveAttribute("href", "/routine-programs/42");
    expect(screen.getByText("Open Program")).toBeInTheDocument();
  });

  it("renders the program author in place of the summary when present", () => {
    render(
      <RoutineProgramCard
        program={makeRoutineProgramSummary({
          author: "Jeff Nippard",
          day_count: 3,
          exercise_count: 12,
        })}
      />,
    );

    expect(screen.getByText("By Jeff Nippard")).toBeInTheDocument();
    expect(screen.queryByText(/3 days • 12 exercises/i)).not.toBeInTheDocument();
  });

  it("falls back to the day and exercise summary when author is absent", () => {
    render(
      <RoutineProgramCard
        program={makeRoutineProgramSummary({
          author: null,
          day_count: 3,
          exercise_count: 12,
        })}
      />,
    );

    expect(screen.queryByText(/^By /i)).not.toBeInTheDocument();
    expect(screen.getByText(/3 days • 12 exercises/i)).toBeInTheDocument();
  });
});
