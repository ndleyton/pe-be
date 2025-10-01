import React from 'react';
import { Dumbbell } from 'lucide-react';
import { parseWorkoutDuration, formatDisplayDate } from '@/utils/date';
import type { Workout } from '@/features/workouts';

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
  onTouchStart
}) => {
  return (
    <div
      onClick={() => onClick(workout.id)}
      onMouseEnter={onMouseEnter}
      onTouchStart={onTouchStart}
      className="bg-card rounded-lg p-4 flex items-center justify-between cursor-pointer hover:bg-accent transition-colors"
    >
      <div className="flex items-center space-x-4">
        <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
          <Dumbbell className="w-5 h-5 text-primary-foreground" />
        </div>
        <div>
          <h3 className="text-foreground font-medium">
            {workout.name || 'Traditional Strength Training'}
          </h3>
          <div className="flex items-center space-x-4 mt-1">
            <span className="text-primary font-mono text-lg">
              {parseWorkoutDuration(workout.start_time, workout.end_time).durationText}
            </span>
            <span className="text-muted-foreground text-sm">
              {formatDisplayDate(workout.start_time, { includeTime: false, includeTimezone: false })}
            </span>
          </div>
        </div>
      </div>
      <div className="text-muted-foreground">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </div>
  );
};

export default WorkoutCard;
