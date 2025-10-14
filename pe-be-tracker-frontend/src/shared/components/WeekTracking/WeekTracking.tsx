import { memo } from "react";
import { Flame } from "lucide-react";

interface Workout {
  id: number | string;
  name: string | null;
  notes: string | null;
  start_time: string;
  end_time: string | null;
}

interface WeekTrackingProps {
  workouts: Workout[] | undefined;
  className?: string;
  loading?: boolean;
}

const WeekTracking = memo(
  ({ workouts, className = "", loading = false }: WeekTrackingProps) => {
    const safeWorkouts = Array.isArray(workouts) ? workouts : [];

    const getLast7Days = () => {
      const days = [];
      const today = new Date();

      for (let i = 6; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(today.getDate() - i);
        days.push(date);
      }

      return days;
    };

    const hasWorkoutOnDate = (date: Date) => {
      // If loading or no workouts data, return false (show neutral state)
      if (loading || safeWorkouts.length === 0) return false;
      const dateString = date.toDateString();
      return safeWorkouts.some((workout) => {
        const workoutDate = new Date(workout.start_time);
        return workoutDate.toDateString() === dateString;
      });
    };

    const getDayName = (date: Date) => {
      const days = ["S", "M", "T", "W", "T", "F", "S"];
      return days[date.getDay()];
    };

    const last7Days = getLast7Days();

    return (
      <div
        className={`bg-border rounded-3xl p-4 shadow-md ${className}`}
        data-testid="week-tracking"
        aria-busy={loading || undefined}
      >
        <div className="flex items-center justify-between gap-1">
          {last7Days.map((date, index) => {
            const hasWorkout = hasWorkoutOnDate(date);
            const isToday = date.toDateString() === new Date().toDateString();

            return (
              <div key={index} className="flex flex-col items-center gap-1">
                <span
                  className={`text-xs font-semibold ${isToday ? "text-primary" : "text-card-foreground/60"}`}
                >
                  {getDayName(date)}
                </span>
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors ${
                    hasWorkout
                      ? "bg-warning text-warning-foreground"
                      : "bg-background/40"
                  }`}
                  title={`${date.toLocaleDateString()}: ${hasWorkout ? "Workout completed" : "No workout"}`}
                >
                  {hasWorkout && <Flame className="h-5 w-5 text-orange-500" />}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  },
);

WeekTracking.displayName = "WeekTracking";

export default WeekTracking;
