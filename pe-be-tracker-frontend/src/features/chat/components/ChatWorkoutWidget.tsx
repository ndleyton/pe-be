import { Link } from "react-router-dom";
import { Dumbbell } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { NAV_PATHS } from "@/shared/navigation/constants";
import { formatDisplayDate, parseWorkoutDuration } from "@/utils/date";
import { WorkoutCreatedEvent } from "../types";

export const ChatWorkoutWidget = ({ event }: { event: WorkoutCreatedEvent }) => {
  const workoutPath = `${NAV_PATHS.WORKOUTS}/${event.workout.id}`;
  const startedAt = formatDisplayDate(event.workout.start_time, {
    includeTime: false,
    includeTimezone: false,
  });
  const duration = parseWorkoutDuration(
    event.workout.start_time,
    event.workout.end_time,
  ).durationText;

  return (
    <div className="bg-background/70 border-border/40 mt-3 rounded-2xl border p-3">
      <div className="flex items-start gap-3">
        <div className="bg-primary/10 text-primary flex h-10 w-10 shrink-0 items-center justify-center rounded-xl">
          <Dumbbell className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-muted-foreground text-[11px] font-semibold uppercase tracking-[0.16em]">
            {event.title ?? "Workout created"}
          </p>
          <p className="text-foreground mt-1 text-sm font-semibold">
            {event.workout.name || "Traditional Strength Training"}
          </p>
          <div className="text-muted-foreground mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs">
            {startedAt && <span>{startedAt}</span>}
            <span>{duration}</span>
          </div>
        </div>
      </div>

      {event.workout.notes && (
        <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
          {event.workout.notes}
        </p>
      )}

      <Button asChild variant="secondary" size="sm" className="mt-3 w-full">
        <Link to={workoutPath}>{event.ctaLabel ?? "Open workout"}</Link>
      </Button>
    </div>
  );
};
