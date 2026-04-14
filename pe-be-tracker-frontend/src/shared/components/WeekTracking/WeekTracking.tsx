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

    return (
      <div
        className={cn(
          "relative overflow-hidden rounded-3xl border border-border/50 bg-card/40 p-5 shadow-xl backdrop-blur-xl dark:bg-card/20",
          className,
        )}
        data-testid="week-tracking"
        aria-busy={loading || undefined}
      >
        <div className="relative z-10 space-y-5">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5 text-left">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
                Weekly Activity
              </p>
              <h2 className="text-lg font-black tracking-tight text-foreground">
                Last 7 days
              </h2>
            </div>
            
            <div className="flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-[11px] font-bold text-primary backdrop-blur-sm">
              <Flame className="h-3 w-3 fill-primary" />
              {loading
                ? "Syncing..."
                : `${currentStreak} Day${currentStreak === 1 ? "" : "s"}`}
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
                      "text-[10px] font-bold tracking-tight text-muted/60 transition-colors uppercase",
                      isToday && "text-primary"
                    )}
                  >
                    {getDayName(date)}
                  </span>

                  <div
                    className={cn(
                      "relative flex h-11 w-11 items-center justify-center rounded-2xl border transition-all duration-200",
                      hasWorkout
                        ? "border-primary/40 bg-primary/10 text-primary shadow-sm"
                        : "border-border/40 bg-white/5 text-muted-foreground/30 dark:bg-white/[0.02]",
                      isToday && !hasWorkout && "border-primary/20 bg-primary/5 shadow-inner",
                    )}
                    title={statusLabel}
                    aria-label={statusLabel}
                  >
                    {hasWorkout ? (
                      <Flame className="h-4.5 w-4.5 fill-primary" />
                    ) : (
                      <span className="text-[11px] font-bold">{date.getDate()}</span>
                    )}

                    {isToday && (
                      <div className="absolute -bottom-1 left-1/2 -translate-x-1/2">
                        <div className="h-1 w-1 rounded-full bg-primary" />
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
