import type { ReactNode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ProgressiveOverloadDataPoint } from "@/features/exercises/api";
import { ProgressiveOverloadChart } from "./ProgressiveOverloadChart";

vi.mock("recharts", () => ({
  AreaChart: ({ data }: { data: unknown }) => <pre data-testid="series">{JSON.stringify(data)}</pre>,
  Area: () => null,
  CartesianGrid: () => null,
  XAxis: () => null,
  YAxis: () => null,
}));
vi.mock("@/shared/components/ui/chart", () => ({
  ChartContainer: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  ChartTooltip: () => null,
  ChartTooltipContent: () => null,
}));

const unit = { id: 1, name: "Kilograms", abbreviation: "kg" };
const points: ProgressiveOverloadDataPoint[] = [
  { date: "2026-09-20", maxWeight: 100, totalVolume: 1000, reps: 10 },
  { date: "2026-09-21", maxWeight: 120, totalVolume: 1200, reps: 10 },
];
const left = { sets: 1, reps: 10, maxWeight: 20, totalVolume: 200 };
const series = () => JSON.parse(screen.getByTestId("series").textContent!);

describe("ProgressiveOverloadChart side gaps", () => {
  it.each([0, 1])("preserves a missing side at index %s in both metrics and trends", (missingIndex) => {
    const data = points.map((point, index) => ({
      ...point,
      sideBreakdown: index === missingIndex ? { right: left } : { left },
    }));
    render(<ProgressiveOverloadChart data={data} intensityUnit={unit} />);
    expect(series()[missingIndex]).toMatchObject({ maxWeight: null, totalVolume: null });
    expect(series()[1 - missingIndex]).toMatchObject({ maxWeight: 20, totalVolume: 200 });
    expect(screen.getByText("Trend unavailable")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Total Volume" }));
    expect(screen.getByText("Trend unavailable")).toBeInTheDocument();
    if (missingIndex === 1) expect(screen.getByText(/Latest: Unavailable/)).toBeInTheDocument();
  });

  it("does not substitute aggregates for a point with no side breakdown", () => {
    render(<ProgressiveOverloadChart data={[{ ...points[0], sideBreakdown: { left } }, points[1]]} intensityUnit={unit} />);
    expect(series()[1]).toMatchObject({ maxWeight: null, totalVolume: null });
    expect(screen.getByText("Trend unavailable")).toBeInTheDocument();
  });

  it("keeps the volume side filter reachable and updates an unavailable selection", () => {
    const { rerender } = render(<ProgressiveOverloadChart data={[{ ...points[0], sideBreakdown: { left } }]} intensityUnit={unit} />);
    fireEvent.click(screen.getByRole("button", { name: "Total Volume" }));
    expect(screen.getByRole("button", { name: "left" })).toHaveAttribute("aria-pressed", "true");
    rerender(<ProgressiveOverloadChart data={[{ ...points[0], sideBreakdown: { right: left } }]} intensityUnit={unit} />);
    expect(screen.getByRole("button", { name: "right" })).toHaveAttribute("aria-pressed", "true");
    expect(series()[0]).toMatchObject({ maxWeight: 20, totalVolume: 200 });
  });

  it("uses aggregates when no side filter exists", () => {
    render(<ProgressiveOverloadChart data={points} intensityUnit={unit} />);
    expect(series()[1]).toMatchObject({ maxWeight: 120, totalVolume: 1200 });
    expect(screen.getByText(/Trending up by 20.0%/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Total Volume" }));
    expect(screen.getByText(/Trending up by 20.0%/)).toBeInTheDocument();
  });
});
