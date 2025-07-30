import React from 'react';
import { TrendingUp } from "lucide-react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import type { ProgressiveOverloadDataPoint } from '@/features/exercises/api';
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/shared/components/ui/chart';

interface ProgressiveOverloadChartProps {
  data: ProgressiveOverloadDataPoint[];
}

const chartConfig = {
  maxWeight: {
    label: "Max Weight (kg)",
    color: "var(--chart-1)",
  },
  totalVolume: {
    label: "Total Volume (kg)",
    color: "var(--chart-2)",
  },
} satisfies ChartConfig;

export const ProgressiveOverloadChart: React.FC<ProgressiveOverloadChartProps> = ({ data }) => {
  if (!data || data.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>No workout data available yet.</p>
      </div>
    );
  }

  // Transform data for the chart
  const chartData = data.map((point) => ({
    date: new Date(point.date).toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric' 
    }),
    maxWeight: point.maxWeight,
    totalVolume: point.totalVolume,
  }));

  // Calculate trend for the latest period
  const latestWeight = data[data.length - 1]?.maxWeight || 0;
  const previousWeight = data[data.length - 2]?.maxWeight || latestWeight;
  const weightTrend = latestWeight > previousWeight;
  const weightChange = latestWeight > 0 && previousWeight > 0 
    ? Math.abs(((latestWeight - previousWeight) / previousWeight) * 100).toFixed(1)
    : '0';

  return (
    <div className="space-y-4">
      <ChartContainer config={chartConfig}>
        <AreaChart
          accessibilityLayer
          data={chartData}
          margin={{
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
          <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
          <Area
            dataKey="totalVolume"
            type="natural"
            fill="var(--color-totalVolume)"
            fillOpacity={0.4}
            stroke="var(--color-totalVolume)"
          />
          <Area
            dataKey="maxWeight"
            type="natural"
            fill="var(--color-maxWeight)"
            fillOpacity={0.4}
            stroke="var(--color-maxWeight)"
          />
        </AreaChart>
      </ChartContainer>

      {/* Summary Stats */}
      <div className="flex w-full items-start gap-2 text-sm">
        <div className="grid gap-2">
          <div className="flex items-center gap-2 leading-none font-medium">
            {weightTrend ? 'Trending up' : 'Steady progress'} by {weightChange}% this session{' '}
            <TrendingUp className="h-4 w-4" />
          </div>
          <div className="text-muted-foreground flex items-center gap-2 leading-none">
            Latest: {latestWeight}kg max weight • {data[data.length - 1]?.totalVolume || 0}kg volume
          </div>
        </div>
      </div>
    </div>
  );
};