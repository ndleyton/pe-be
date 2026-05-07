import { describe, expect, it } from "vitest";

import { makeRoutineProgramSummary } from "@/test/fixtures";
import { render, screen } from "@/test/testUtils";

import { RoutineProgramCard } from "./RoutineProgramCard";

describe("RoutineProgramCard", () => {
  it("renders the program button link", () => {
    render(
      <RoutineProgramCard
        program={makeRoutineProgramSummary({
          id: 42,
          name: "Upper Lower Split",
        })}
      />,
    );

    expect(
      screen.getByRole("link", { name: /open program/i }),
    ).toHaveAttribute("href", "/routine-programs/42");
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

  it('omits the "By" prefix when the author is Classic', () => {
    render(
      <RoutineProgramCard
        program={makeRoutineProgramSummary({
          author: "Classic",
        })}
      />,
    );

    expect(screen.getByText("Classic")).toBeInTheDocument();
    expect(screen.queryByText("By Classic")).not.toBeInTheDocument();
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
