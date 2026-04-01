
import { Dumbbell } from "lucide-react";
import { parseWorkoutDuration, formatDisplayDate } from "@/utils/date";
import type { Workout } from "@/features/workouts";

interface WorkoutCardProps {
  workout: Workout;
  onClick: (workoutId: number | string) => void;
  onMouseEnter?: () => void;
  onTouchStart?: () => void;
}

const WorkoutCard = ({
  workout,
  onClick,
  onMouseEnter,
  onTouchStart,
}: WorkoutCardProps) => {
  return (
    <div
      onClick={() => onClick(workout.id)}
      onMouseEnter={onMouseEnter}
      onTouchStart={onTouchStart}
      className="bg-card/80 border-border hover:bg-accent relative cursor-pointer items-center justify-between overflow-hidden rounded-xl border p-5 transition-all duration-200 shadow-sm hover:shadow-md backdrop-blur-sm"
    >
      <div className="flex items-center space-x-4">
        <div className="bg-primary/10 flex h-12 w-12 items-center justify-center rounded-xl transition-colors group-hover:bg-primary/20">
          <Dumbbell className="text-primary h-6 w-6" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-foreground text-lg font-bold">
              {workout.name || "Traditional Strength Training"}
            </h3>
            {!workout.end_time && (
              <span className="bg-primary/10 text-primary rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider animate-pulse">
                In Progress
              </span>
            )}
          </div>
          <div className="mt-1.5 flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="text-primary font-mono text-sm font-bold">
                {
                  parseWorkoutDuration(workout.start_time, workout.end_time)
                    .durationText
                }
              </span>
            </div>
            <div className="bg-muted-foreground/20 h-1 w-1 rounded-full" />
            <span className="text-muted-foreground text-xs font-medium">
              {formatDisplayDate(workout.start_time, {
                includeTime: false,
                includeTimezone: false,
              })}
            </span>
          </div>
        </div>
      </div>
      <div className="text-muted-foreground/50 absolute right-4 top-1/2 -translate-y-1/2">
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
