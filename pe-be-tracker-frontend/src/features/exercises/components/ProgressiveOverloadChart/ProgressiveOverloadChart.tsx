import { useState } from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import type {
  IntensityUnit,
  ProgressiveOverloadDataPoint,
} from "@/features/exercises/api";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/shared/components/ui/chart";
import { formatDecimal } from "@/utils/format";

interface ProgressiveOverloadChartProps {
  data: ProgressiveOverloadDataPoint[];
  intensityUnit: IntensityUnit;
}

export const ProgressiveOverloadChart = ({
  data,
  intensityUnit,
}: ProgressiveOverloadChartProps) => {
  if (!data || data.length === 0) {
    return (
      <div className="text-muted-foreground py-8 text-center">
        <p>No workout data available yet.</p>
      </div>
    );
  }

  const [activeMetric, setActiveMetric] = useState<
    "maxWeight" | "totalVolume"
  >("maxWeight");
  const availableSides = (["left", "right", "both", "unspecified"] as const)
    .filter((side) => data.some((point) => point.sideBreakdown?.[side]));
  const [activeSide, setActiveSide] = useState<typeof availableSides[number]>(
    availableSides[0] ?? "unspecified",
  );
  const effectiveSide = availableSides.includes(activeSide)
    ? activeSide
    : availableSides[0];
  const chartConfig = {
    maxWeight: {
      label: `Max Weight (${intensityUnit.abbreviation})`,
      color: "var(--chart-1)",
    },
    totalVolume: {
      label: `Recorded Volume (${intensityUnit.abbreviation}·reps)`,
      color: "var(--chart-2)",
    },
  } satisfies ChartConfig;

  // Aggregate values are only valid when there is no side filter.
  const scopedData = data.map((point) =>
    effectiveSide != null ? point.sideBreakdown?.[effectiveSide] : point,
  );
  const chartData = data.map((point, index) => ({
    date: new Date(point.date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    }),
    maxWeight: scopedData[index] == null
      ? null
      : Math.round(scopedData[index].maxWeight * 100) / 100,
    totalVolume: scopedData[index] == null
      ? null
      : Math.round(scopedData[index].totalVolume * 100) / 100,
  }));

  const latestWeight = scopedData.at(-1)?.maxWeight;
  const latestVolume = scopedData.at(-1)?.totalVolume;
  const latestValue = scopedData.at(-1)?.[activeMetric];
  const previousValue = scopedData.at(-2)?.[activeMetric];
  const hasTrend = latestValue != null && previousValue != null && latestValue > 0 && previousValue > 0;
  let trendState: "increasing" | "decreasing" | "unchanged" | "unavailable" = "unavailable";
  if (hasTrend) {
    if (latestValue > previousValue) trendState = "increasing";
    else if (latestValue < previousValue) trendState = "decreasing";
    else trendState = "unchanged";
  }

  const change = hasTrend
    ? Math.abs(((latestValue - previousValue) / previousValue) * 100).toFixed(1)
    : "0";

  return (
    <div className="space-y-4">
      {/* Tabs / Segmented control */}
      <div className="flex w-full items-center justify-center">
        <div className="bg-muted inline-flex items-center gap-1 rounded-lg border p-1">
          <button
            type="button"
            onClick={() => setActiveMetric("maxWeight")}
            aria-pressed={activeMetric === "maxWeight"}
            className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
              activeMetric === "maxWeight"
                ? "bg-background text-foreground shadow"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Max Weight
          </button>
          <button
            type="button"
            onClick={() => setActiveMetric("totalVolume")}
            aria-pressed={activeMetric === "totalVolume"}
            className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
              activeMetric === "totalVolume"
                ? "bg-background text-foreground shadow"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Total Volume
          </button>
        </div>
      </div>
      {availableSides.length > 0 && (
        <div className="flex flex-wrap justify-center gap-1" aria-label="Side filter">
          {availableSides.map((side) => (
            <button
              type="button"
              key={side}
              aria-pressed={effectiveSide === side}
              onClick={() => setActiveSide(side)}
              className={`rounded-md border px-2 py-1 text-xs capitalize ${effectiveSide === side ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
            >
              {side === "both" ? "Both sides" : side}
            </button>
          ))}
        </div>
      )}

      <div className="mt-4">
        <ChartContainer config={chartConfig}>
          <AreaChart
            accessibilityLayer
            data={chartData}
            margin={{
              top: 10,
              left: -20,
              right: 12,
            }}
          >
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickCount={3}
            />
            <ChartTooltip
              cursor={false}
              content={(props) => <ChartTooltipContent {...props} />}
            />
            {activeMetric === "maxWeight" ? (
              <Area
                dataKey="maxWeight"
                type="natural"
                fill="var(--color-maxWeight)"
                fillOpacity={0.4}
                stroke="var(--color-maxWeight)"
              />
            ) : (
              <Area
                dataKey="totalVolume"
                type="natural"
                fill="var(--color-totalVolume)"
                fillOpacity={0.4}
                stroke="var(--color-totalVolume)"
              />
            )}
          </AreaChart>
        </ChartContainer>
      </div>

      {/* Summary Stats */}
      <div className="flex w-full items-start gap-2 text-sm">
        <div className="grid gap-2">
          <div className="flex items-center gap-2 leading-none font-medium">
            {trendState === "increasing" ? (
              <>Trending up by {change}% this session <TrendingUp className="text-activity h-4 w-4" /></>
            ) : trendState === "decreasing" ? (
              <>Trending down by {change}% this session <TrendingDown className="text-destructive h-4 w-4" /></>
            ) : trendState === "unchanged" ? (
              <>Steady progress this session <Minus className="text-muted-foreground h-4 w-4" /></>
            ) : (
              "Trend unavailable"
            )}
          </div>
          <div className="text-muted-foreground flex items-center gap-2 leading-none">
            {activeMetric === "maxWeight" ? (
              <>
                Latest: {latestWeight == null ? "Unavailable" : formatDecimal(latestWeight)}
                {latestWeight != null && intensityUnit.abbreviation} max weight
              </>
            ) : (
              <>
                Latest: {latestVolume == null ? "Unavailable" : formatDecimal(latestVolume)}
                {latestVolume != null && intensityUnit.abbreviation} total volume
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
