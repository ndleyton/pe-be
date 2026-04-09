import { useState } from "react";
import { TrendingUp } from "lucide-react";
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
  const chartConfig = {
    maxWeight: {
      label: `Max Weight (${intensityUnit.abbreviation})`,
      color: "var(--chart-1)",
    },
    totalVolume: {
      label: `Total Volume (${intensityUnit.abbreviation})`,
      color: "var(--chart-2)",
    },
  } satisfies ChartConfig;

  // Transform data for the chart
  const chartData = data.map((point) => ({
    date: new Date(point.date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    }),
    maxWeight: Math.round(point.maxWeight * 100) / 100,
    totalVolume: Math.round(point.totalVolume * 100) / 100,
  }));

  // Calculate trend for the latest period
  const latestWeight = data[data.length - 1]?.maxWeight || 0;
  const previousWeight = data[data.length - 2]?.maxWeight || latestWeight;
  const weightTrend = latestWeight > previousWeight;
  const weightChange =
    latestWeight > 0 && previousWeight > 0
      ? Math.abs(
          ((latestWeight - previousWeight) / previousWeight) * 100,
        ).toFixed(1)
      : "0";

  const latestVolume = data[data.length - 1]?.totalVolume || 0;
  const previousVolume = data[data.length - 2]?.totalVolume || latestVolume;
  const volumeTrend = latestVolume > previousVolume;
  const volumeChange =
    latestVolume > 0 && previousVolume > 0
      ? Math.abs(
          ((latestVolume - previousVolume) / previousVolume) * 100,
        ).toFixed(1)
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
            {activeMetric === "maxWeight"
              ? weightTrend
                ? "Trending up"
                : "Steady progress"
              : volumeTrend
                ? "Trending up"
                : "Steady progress"}{" "}
            by {activeMetric === "maxWeight" ? weightChange : volumeChange}%
            this session <TrendingUp className="h-4 w-4" />
          </div>
          <div className="text-muted-foreground flex items-center gap-2 leading-none">
            {activeMetric === "maxWeight" ? (
              <>
                Latest: {formatDecimal(latestWeight)}
                {intensityUnit.abbreviation} max weight
              </>
            ) : (
              <>
                Latest: {formatDecimal(latestVolume)}
                {intensityUnit.abbreviation} total volume
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
