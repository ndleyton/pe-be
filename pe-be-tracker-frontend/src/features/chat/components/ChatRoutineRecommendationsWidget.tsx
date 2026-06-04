import { Link } from "react-router-dom";
import { Dumbbell } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { NAV_PATHS } from "@/shared/navigation/constants";
import { RoutineRecommendedEvent } from "../types";

const formatCount = (count: number, singular: string) =>
  `${count} ${singular}${count === 1 ? "" : "s"}`;

export const ChatRoutineRecommendationsWidget = ({
  event,
}: {
  event: RoutineRecommendedEvent;
}) => {
  if (!event.recommendations.length) {
    return null;
  }

  return (
    <div className="bg-background/70 border-border/40 mt-3 rounded-2xl border p-3">
      <div className="mb-3 flex items-start gap-3">
        <div className="bg-primary/10 text-primary flex h-10 w-10 shrink-0 items-center justify-center rounded-xl">
          <Dumbbell className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-muted-foreground text-[11px] font-semibold uppercase tracking-[0.16em]">
            {event.title ?? "Recommended routines"}
          </p>
          <p className="text-foreground mt-1 text-sm font-semibold">
            Public library matches
          </p>
        </div>
      </div>

      <div className="grid gap-3">
        {event.recommendations.map((routine) => {
          const routinePath = `${NAV_PATHS.ROUTINES}/${routine.id}`;
          const metadata = [routine.category, routine.author].filter(Boolean);

          return (
            <div
              key={routine.id}
              className="border-border/50 bg-background/80 rounded-xl border p-3"
            >
              <p className="text-foreground text-sm font-semibold">{routine.name}</p>
              {metadata.length > 0 && (
                <p className="text-muted-foreground mt-1 text-xs">
                  {metadata.join(" · ")}
                </p>
              )}
              <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                {routine.reason}
              </p>
              <div className="text-muted-foreground mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs">
                <span>{formatCount(routine.exerciseCount, "exercise")}</span>
                <span>{formatCount(routine.setCount, "set")}</span>
              </div>
              {routine.exerciseNamesPreview.length > 0 && (
                <p className="text-muted-foreground mt-2 line-clamp-2 text-xs">
                  {routine.exerciseNamesPreview.join(", ")}
                </p>
              )}
              <Button asChild variant="secondary" size="sm" className="mt-3 w-full">
                <Link to={routinePath}>View routine</Link>
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
