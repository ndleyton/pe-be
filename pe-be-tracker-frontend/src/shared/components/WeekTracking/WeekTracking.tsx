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

    const activeDays = loading
      ? 0
      : last7Days.filter((date) => hasWorkoutOnDate(date)).length;

    return (
      <div
        className={cn(
          "relative overflow-hidden rounded-3xl border border-white/45 bg-gradient-to-br from-white/70 via-white/35 to-primary/8 p-4 shadow-[0_20px_55px_-28px_rgba(204,0,51,0.35)] backdrop-blur-xl dark:border-white/10 dark:from-white/10 dark:via-white/[0.07] dark:to-primary/15",
          className,
        )}
        data-testid="week-tracking"
        aria-busy={loading || undefined}
      >
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-white/90 to-transparent dark:via-white/30" />
          <div className="absolute -right-10 -top-12 h-28 w-28 rounded-full bg-primary/12 blur-3xl dark:bg-primary/15" />
          <div className="absolute -bottom-16 left-0 h-28 w-28 rounded-full bg-warning/10 blur-3xl dark:bg-warning/10" />
        </div>

        <div className="relative z-10">
          <div className="flex items-start justify-between gap-3">
            <div className="text-left">
              <p className="text-muted-foreground/80 text-[10px] font-black uppercase tracking-[0.28em]">
                Weekly Activity
              </p>
              <h2 className="text-foreground mt-1 text-lg font-black tracking-tight">
                Last 7 days
              </h2>
            </div>
            <div className="rounded-full border border-white/55 bg-white/45 px-3 py-1 text-[11px] font-bold text-foreground/75 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] backdrop-blur-md dark:border-white/10 dark:bg-white/10 dark:text-foreground/80">
              {loading ? "Syncing..." : `${activeDays}/7 active`}
            </div>
          </div>

          <div
            className="mt-4 grid grid-cols-7 gap-2 sm:gap-3"
            role="list"
            aria-label="Last 7 days workout activity"
          >
            {last7Days.map((date) => {
            const hasWorkout = hasWorkoutOnDate(date);
            const isToday = date.toDateString() === new Date().toDateString();
            const statusLabel = `${date.toLocaleDateString()}: ${hasWorkout ? "Workout completed" : "No workout logged"}`;

            return (
              <div
                key={date.toISOString()}
                className="flex flex-col items-center gap-2"
                role="listitem"
              >
                <span
                  className={cn(
                    "rounded-full px-2 py-1 text-[11px] font-black tracking-[0.18em] uppercase transition-colors",
                    isToday
                      ? "bg-primary/12 text-primary shadow-[0_0_0_1px_rgba(204,0,51,0.08)] dark:bg-primary/18"
                      : "text-card-foreground/60",
                  )}
                >
                  {getDayName(date)}
                </span>
                <div
                  className={cn(
                    "relative flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl border text-sm font-black transition-all duration-300",
                    hasWorkout
                      ? "border-white/50 bg-gradient-to-br from-warning/95 via-orange-400 to-primary/85 text-white shadow-[0_14px_35px_-16px_rgba(204,0,51,0.75)]"
                      : "border-white/55 bg-white/45 text-muted-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] dark:border-white/10 dark:bg-white/[0.06]",
                    isToday && !hasWorkout && "scale-[1.02] border-primary/20 text-primary/80",
                  )}
                  title={statusLabel}
                  aria-label={statusLabel}
                >
                  <div
                    className={cn(
                      "absolute inset-0 rounded-2xl",
                      hasWorkout
                        ? "bg-white/10"
                        : "bg-gradient-to-b from-white/60 to-transparent dark:from-white/[0.06]",
                    )}
                  />
                  {hasWorkout ? (
                    <Flame className="relative z-10 h-5 w-5" />
                  ) : (
                    <span className="relative z-10">{date.getDate()}</span>
                  )}
                </div>
                {isToday ? (
                  <span className="h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_16px_rgba(204,0,51,0.65)]" />
                ) : (
                  <span className="h-1.5 w-1.5 rounded-full bg-transparent" />
                )}
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
