import React from "react";
import { Dumbbell } from "lucide-react";
import { parseWorkoutDuration, formatDisplayDate } from "@/utils/date";
import type { Workout } from "@/features/workouts";

interface WorkoutCardProps {
  workout: Workout;
  onClick: (workoutId: number | string) => void;
  onMouseEnter?: () => void;
  onTouchStart?: () => void;
}

const WorkoutCard: React.FC<WorkoutCardProps> = ({
  workout,
  onClick,
  onMouseEnter,
  onTouchStart,
}) => {
  return (
    <div
      onClick={() => onClick(workout.id)}
      onMouseEnter={onMouseEnter}
      onTouchStart={onTouchStart}
      className="bg-card hover:bg-accent flex cursor-pointer items-center justify-between rounded-lg p-4 transition-colors"
    >
      <div className="flex items-center space-x-4">
        <div className="bg-primary flex h-10 w-10 items-center justify-center rounded-lg">
          <Dumbbell className="text-primary-foreground h-5 w-5" />
        </div>
        <div>
          <h3 className="text-foreground font-medium">
            {workout.name || "Traditional Strength Training"}
          </h3>
          <div className="mt-1 flex items-center space-x-4">
            <span className="text-primary font-mono text-lg">
              {
                parseWorkoutDuration(workout.start_time, workout.end_time)
                  .durationText
              }
            </span>
            <span className="text-muted-foreground text-sm">
              {formatDisplayDate(workout.start_time, {
                includeTime: false,
                includeTimezone: false,
              })}
            </span>
          </div>
        </div>
      </div>
      <div className="text-muted-foreground">
        <svg
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 5l7 7-7 7"
          />
        </svg>
      </div>
    </div>
  );
};

export default WorkoutCard;
