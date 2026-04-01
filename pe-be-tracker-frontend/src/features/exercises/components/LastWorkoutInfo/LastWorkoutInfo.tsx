import React from "react";
import type {
  LastWorkoutData as LastWorkoutInfoType,
  IntensityUnit,
} from "@/features/exercises/api";
import { formatDecimal } from "@/utils/format";

interface LastWorkoutInfoProps {
  lastWorkout: LastWorkoutInfoType;
  intensityUnit: IntensityUnit;
}

export const LastWorkoutInfo: React.FC<LastWorkoutInfoProps> = ({
  lastWorkout,
  intensityUnit,
}) => {
  const workoutDate = new Date(lastWorkout.date).toLocaleDateString();

  return (
    <div className="space-y-3">
      <div className="text-muted-foreground text-sm">{workoutDate}</div>

      <div className="space-y-2">
        <div className="flex justify-between">
          <span className="text-muted-foreground text-sm">Sets:</span>
          <span className="font-medium">{lastWorkout.sets}</span>
        </div>

        <div className="flex justify-between">
          <span className="text-muted-foreground text-sm">Total Reps:</span>
          <span className="font-medium">{lastWorkout.totalReps}</span>
        </div>

        <div className="flex justify-between">
          <span className="text-muted-foreground text-sm">Max Weight:</span>
          <span className="font-medium">
            {formatDecimal(lastWorkout.maxWeight)}
            {intensityUnit.abbreviation}
          </span>
        </div>

        <div className="flex justify-between">
          <span className="text-muted-foreground text-sm">Total Volume:</span>
          <span className="font-medium">
            {formatDecimal(lastWorkout.totalVolume)}
            {intensityUnit.abbreviation}
          </span>
        </div>
      </div>

      <div className="border-t pt-2">
        <p className="text-muted-foreground text-sm">
          Last time you did{" "}
          <span className="font-semibold">{lastWorkout.sets} sets</span> with{" "}
          <span className="font-semibold">
            {formatDecimal(lastWorkout.maxWeight)}
            {intensityUnit.abbreviation}
          </span>{" "}
          max weight
        </p>
      </div>
    </div>
  );
};
