import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@/test/testUtils";
import WeekTracking from "./WeekTracking";

describe("WeekTracking", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 3, 13, 12, 0, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders weekly activity with completed workout state", () => {
    render(
      <WeekTracking
        workouts={[
          {
            id: 1,
            name: "Upper Body",
            notes: null,
            start_time: new Date(2026, 3, 13, 9, 0, 0).toISOString(),
            end_time: new Date(2026, 3, 13, 10, 0, 0).toISOString(),
          },
        ]}
      />,
    );

    expect(screen.getByText("Weekly Activity")).toBeInTheDocument();
    expect(screen.getByTestId("week-tracking")).toHaveTextContent(/1\/7 active/);
    expect(screen.getAllByRole("listitem")).toHaveLength(7);
    expect(screen.getByLabelText(/Workout completed/i)).toBeInTheDocument();
  });

  it("keeps the tracker neutral while workout data is loading", () => {
    render(
      <WeekTracking
        loading
        workouts={[
          {
            id: 1,
            name: "Upper Body",
            notes: null,
            start_time: new Date(2026, 3, 13, 9, 0, 0).toISOString(),
            end_time: new Date(2026, 3, 13, 10, 0, 0).toISOString(),
          },
        ]}
      />,
    );

    expect(screen.getByTestId("week-tracking")).toHaveAttribute("aria-busy", "true");
    expect(screen.getByText("Syncing...")).toBeInTheDocument();
    expect(screen.queryByLabelText(/Workout completed/i)).not.toBeInTheDocument();
  });
});
