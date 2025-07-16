import React from 'react';
import type { ProgressiveOverloadDataPoint } from '@/features/exercises/api';

interface ProgressiveOverloadChartProps {
  data: ProgressiveOverloadDataPoint[];
}

export const ProgressiveOverloadChart: React.FC<ProgressiveOverloadChartProps> = ({ data }) => {
  if (!data || data.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>No workout data available yet.</p>
      </div>
    );
  }

  const maxWeight = Math.max(...data.map(d => d.maxWeight));
  const maxVolume = Math.max(...data.map(d => d.totalVolume));

  return (
    <div className="space-y-4">
      {/* Chart Legend */}
      <div className="flex flex-wrap gap-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-primary rounded"></div>
          <span>Max Weight</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-secondary rounded"></div>
          <span>Total Volume</span>
        </div>
      </div>

      {/* Simple Chart Visualization */}
      <div className="space-y-2">
        {data.slice(-10).map((point, index) => {
          const weightPercentage = (point.maxWeight / maxWeight) * 100;
          const volumePercentage = (point.totalVolume / maxVolume) * 100;
          const date = new Date(point.date).toLocaleDateString();

          return (
            <div key={index} className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{date}</span>
                <span>{point.maxWeight}kg • {point.totalVolume}kg vol</span>
              </div>
              
              {/* Weight Bar */}
              <div className="relative h-2 bg-muted rounded">
                <div 
                  className="absolute left-0 top-0 h-full bg-primary rounded"
                  style={{ width: `${weightPercentage}%` }}
                />
              </div>
              
              {/* Volume Bar */}
              <div className="relative h-1 bg-muted rounded">
                <div 
                  className="absolute left-0 top-0 h-full bg-secondary rounded"
                  style={{ width: `${volumePercentage}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 gap-4 pt-4 border-t">
        <div className="text-center">
          <div className="text-lg font-semibold text-primary">
            {data[data.length - 1]?.maxWeight || 0}kg
          </div>
          <div className="text-xs text-muted-foreground">Latest Max Weight</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-semibold text-secondary">
            {data[data.length - 1]?.totalVolume || 0}kg
          </div>
          <div className="text-xs text-muted-foreground">Latest Volume</div>
        </div>
      </div>
    </div>
  );
};