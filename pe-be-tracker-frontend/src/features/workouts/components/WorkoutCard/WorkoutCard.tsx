
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
  const isInProgress = !workout.end_time;
  const duration = parseWorkoutDuration(workout.start_time, workout.end_time);

  return (
    <div
      onClick={() => onClick(workout.id)}
      onMouseEnter={onMouseEnter}
      onTouchStart={onTouchStart}
      className="bg-card/60 border border-border/40 group relative cursor-pointer overflow-hidden rounded-2xl p-4 pr-10 text-left shadow-sm backdrop-blur-md transition-all duration-300 hover:scale-[1.01] hover:border-primary/30 hover:shadow-2xl hover:shadow-primary/5 active:scale-[0.99] sm:p-5 sm:pr-12"
    >
      <div className="flex items-start gap-3 sm:items-center sm:gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary shadow-inner transition-all duration-300 group-hover:bg-primary group-hover:text-primary-foreground group-hover:shadow-lg group-hover:shadow-primary/20 sm:h-12 sm:w-12 sm:rounded-xl">
          <Dumbbell className="h-5 w-5 sm:h-6 sm:w-6" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-foreground min-w-0 truncate text-base font-bold leading-tight tracking-tight transition-colors group-hover:text-primary sm:text-lg">
              {workout.name || "Traditional Strength Training"}
            </h3>
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
            {isInProgress ? (
              <span className="bg-primary/10 text-primary rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider animate-pulse">
                In Progress
              </span>
            ) : (
              <div className="flex items-center gap-1.5">
                <span className="text-primary font-mono text-sm font-bold">
                  {duration.durationText}
                </span>
              </div>
            )}
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
      <div className="text-muted-foreground/30 absolute right-3 top-1/2 -translate-y-1/2 transition-all duration-300 group-hover:text-primary sm:right-4 group-hover:translate-x-0.5">
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
