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
    expect(screen.getByText("Great work!")).toBeInTheDocument();
    expect(screen.getByTestId("week-tracking")).toHaveTextContent(/1 Day/);
    expect(screen.getAllByRole("listitem")).toHaveLength(7);
    expect(screen.getByLabelText(/Workout completed/i)).toBeInTheDocument();
  });

  it("counts a streak from yesterday when today has no workout yet", () => {
    render(
      <WeekTracking
        workouts={[
          {
            id: 1,
            name: "Leg Day",
            notes: null,
            start_time: new Date(2026, 3, 12, 9, 0, 0).toISOString(),
            end_time: new Date(2026, 3, 12, 10, 0, 0).toISOString(),
          },
          {
            id: 2,
            name: "Push",
            notes: null,
            start_time: new Date(2026, 3, 11, 9, 0, 0).toISOString(),
            end_time: new Date(2026, 3, 11, 10, 0, 0).toISOString(),
          },
        ]}
      />,
    );

    expect(screen.getByTestId("week-tracking")).toHaveTextContent(/2 Days/);
    expect(screen.getByText("Great work!")).toBeInTheDocument();
  });

  it("uses an encouragement message when no streak is active", () => {
    render(<WeekTracking workouts={[]} />);

    expect(screen.getByText("Let's start a streak!")).toBeInTheDocument();
    expect(screen.getByTestId("week-tracking")).toHaveTextContent(/0 Days/);
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
    expect(screen.getByText("Let's start a streak!")).toBeInTheDocument();
    expect(screen.getByTestId("week-tracking")).toHaveTextContent(/0 Days/);
    expect(screen.queryByLabelText(/Workout completed/i)).not.toBeInTheDocument();
  });
});
