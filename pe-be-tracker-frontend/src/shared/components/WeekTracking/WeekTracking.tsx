import { memo } from "react";
import { Flame } from "lucide-react";
import { cn } from "@/lib/utils";

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

const DAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

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

const getCurrentStreak = (workoutDates: Set<string>) => {
  if (workoutDates.size === 0) return 0;

  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  const startDate = workoutDates.has(today.toDateString())
    ? today
    : workoutDates.has(yesterday.toDateString())
      ? yesterday
      : null;

  if (!startDate) return 0;

  let streak = 0;
  const cursor = new Date(startDate);

  while (workoutDates.has(cursor.toDateString())) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
};

const WeekTracking = memo(
  ({ workouts, className = "", loading = false }: WeekTrackingProps) => {
    const safeWorkouts = Array.isArray(workouts) ? workouts : [];
    const last7Days = getLast7Days();
    const workoutDates = new Set(
      loading
        ? []
        : safeWorkouts.map((workout) => new Date(workout.start_time).toDateString()),
    );

    const hasWorkoutOnDate = (date: Date) => {
      if (loading || workoutDates.size === 0) return false;
      return workoutDates.has(date.toDateString());
    };

    const getDayName = (date: Date) => {
      return DAY_LABELS[date.getDay()];
    };

    const currentStreak = loading ? 0 : getCurrentStreak(workoutDates);
    const streakHeading =
      currentStreak === 0 ? "Let's start a streak!" : "Great work!";

    return (
      <div
        className={cn(
          "rounded-3xl bg-border p-4 shadow-md",
          className,
        )}
        data-testid="week-tracking"
        aria-busy={loading || undefined}
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5 text-left">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
                Weekly Activity
              </p>
              <h2 className="text-lg font-black tracking-tight text-foreground">
                {streakHeading}
              </h2>
            </div>

            <div className="flex items-center gap-1.5 rounded-full bg-background/40 px-3 py-1 text-[11px] font-bold text-card-foreground/70">
              <Flame className="h-3 w-3 fill-primary" />
              {`${currentStreak} Day${currentStreak === 1 ? "" : "s"}`}
            </div>
          </div>

          <div
            className="flex justify-between gap-1"
            role="list"
            aria-label="Last 7 days workout activity"
          >
            {last7Days.map((date) => {
              const hasWorkout = hasWorkoutOnDate(date);
              const isToday = date.toDateString() === new Date().toDateString();
              const statusLabel = `${date.toLocaleDateString()}: ${
                hasWorkout ? "Workout completed" : "No workout logged"
              }`;

              return (
                <div
                  key={date.toISOString()}
                  className="flex flex-col items-center gap-2.5"
                  role="listitem"
                >
                  <span
                    className={cn(
                      "text-[10px] font-bold uppercase tracking-tight text-card-foreground/60 transition-colors",
                      isToday && "text-primary",
                    )}
                  >
                    {getDayName(date)}
                  </span>

                  <div
                    className={cn(
                      "relative flex h-9 w-9 items-center justify-center rounded-xl border text-[10px] transition-all duration-200 sm:h-11 sm:w-11 sm:rounded-2xl sm:text-[11px]",
                      hasWorkout
                        ? "border-primary/30 bg-primary/10 text-primary"
                        : "border-border/40 bg-background/40 text-muted-foreground/30",
                      isToday && !hasWorkout && "border-primary/20 bg-background/40",
                    )}
                    title={statusLabel}
                    aria-label={statusLabel}
                  >
                    {hasWorkout ? (
                      <Flame className="h-4 w-4 fill-primary sm:h-4.5 sm:w-4.5" />
                    ) : (
                      <span className="font-bold">{date.getDate()}</span>
                    )}

                    {isToday && (
                      <div className="absolute -bottom-1 left-1/2 -translate-x-1/2">
                        <div className="h-1 w-1 rounded-full bg-primary sm:h-1.5 sm:w-1.5" />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  },
);

WeekTracking.displayName = "WeekTracking";

export default WeekTracking;
