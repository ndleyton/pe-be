import { Link } from "react-router-dom";
import { Dumbbell } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { NAV_PATHS } from "@/shared/navigation/constants";
import { RoutineCreatedEvent } from "../types";

export const ChatRoutineWidget = ({ event }: { event: RoutineCreatedEvent }) => {
  const routinePath = `${NAV_PATHS.ROUTINES}/${event.routine.id}`;
  const exerciseLabel = `${event.routine.exercise_count} exercise${event.routine.exercise_count === 1 ? "" : "s"}`;
  const setLabel = `${event.routine.set_count} set${event.routine.set_count === 1 ? "" : "s"}`;

  return (
    <div className="bg-background/70 border-border/40 mt-3 rounded-2xl border p-3">
      <div className="flex items-start gap-3">
        <div className="bg-primary/10 text-primary flex h-10 w-10 shrink-0 items-center justify-center rounded-xl">
          <Dumbbell className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-muted-foreground text-[11px] font-semibold uppercase tracking-[0.16em]">
            {event.title ?? "Routine created"}
          </p>
          <p className="text-foreground mt-1 text-sm font-semibold">
            {event.routine.name}
          </p>
          <div className="text-muted-foreground mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs">
            <span>{exerciseLabel}</span>
            <span>{setLabel}</span>
          </div>
        </div>
      </div>

      {event.routine.description && (
        <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
          {event.routine.description}
        </p>
      )}

      <Button asChild variant="secondary" size="sm" className="mt-3 w-full">
        <Link to={routinePath}>{event.ctaLabel ?? "View routine"}</Link>
      </Button>
    </div>
  );
};
