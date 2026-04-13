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
          "relative overflow-hidden rounded-[2rem] border border-white/20 bg-white/10 p-6 shadow-2xl backdrop-blur-2xl transition-all duration-500 hover:border-white/30 dark:border-white/10 dark:bg-white/5",
          className,
        )}
        data-testid="week-tracking"
        aria-busy={loading || undefined}
      >
        {/* Subtle Background Glows */}
        <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
          <div className="absolute -right-[10%] -top-[20%] h-64 w-64 rounded-full bg-primary/20 blur-[100px] transition-transform duration-1000" />
          <div className="absolute -bottom-[20%] -left-[10%] h-64 w-64 rounded-full bg-primary/10 blur-[80px]" />
        </div>

        <div className="relative z-10 space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary/80">
                Weekly Activity
              </p>
              <h2 className="text-xl font-black tracking-tight text-foreground/90">
                Last 7 days
              </h2>
            </div>
            
            <div className="group relative">
              <div className="absolute -inset-1 rounded-full bg-primary/20 opacity-0 blur transition duration-500 group-hover:opacity-100" />
              <div className="relative flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-xs font-bold text-foreground/80 backdrop-blur-md dark:border-white/10 dark:bg-white/5">
                {loading ? (
                   "Syncing..."
                ) : (
                  <span className="flex items-center">
                    <span className="text-primary">{activeDays}</span><span className="opacity-40">/7 active</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          <div
            className="flex justify-between"
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
                  className="flex flex-col items-center gap-3"
                  role="listitem"
                >
                  <span
                    className={cn(
                      "text-[10px] font-black tracking-widest text-muted-foreground/50 transition-colors uppercase",
                      isToday && "text-primary font-black"
                    )}
                  >
                    {getDayName(date)}
                  </span>

                  <div
                    className={cn(
                      "group relative flex h-12 w-12 items-center justify-center rounded-2xl border transition-all duration-300",
                      hasWorkout
                        ? "border-primary/30 bg-primary/10 shadow-[0_8px_30px_rgb(204,0,51,0.2)]"
                        : "border-white/10 bg-white/5 text-muted-foreground/40",
                      isToday && !hasWorkout && "border-primary/40 bg-primary/5",
                      "hover:scale-105 active:scale-95"
                    )}
                    title={statusLabel}
                    aria-label={statusLabel}
                  >
                    {/* Inner Shine Effect */}
                    <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/10 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

                    {hasWorkout ? (
                      <div className="relative">
                        <Flame className="h-5 w-5 fill-primary text-primary drop-shadow-[0_0_8px_rgba(204,0,51,0.5)]" />
                        <div className="absolute -inset-1 animate-pulse rounded-full bg-primary/20 blur-md" />
                      </div>
                    ) : (
                      <span className="relative z-10 text-xs font-bold">{date.getDate()}</span>
                    )}

                    {/* Active Today Indicator Dot */}
                    {isToday && (
                      <div className="absolute -bottom-1 left-1/2 -translate-x-1/2">
                        <div className="h-1 w-1 rounded-full bg-primary shadow-[0_0_8px_rgba(204,0,51,1)]" />
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
