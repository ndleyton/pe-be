import { Link } from "react-router-dom";
import { CalendarDays } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { NAV_PATHS } from "@/shared/navigation/constants";
import { RoutineProgramRecommendedEvent } from "../types";

const formatCount = (count: number, singular: string) =>
  `${count} ${singular}${count === 1 ? "" : "s"}`;

export const ChatRoutineProgramRecommendationsWidget = ({
  event,
}: {
  event: RoutineProgramRecommendedEvent;
}) => {
  if (!event.recommendations.length) {
    return null;
  }

  return (
    <div className="bg-background/70 border-border/40 mt-3 rounded-2xl border p-3">
      <div className="mb-3 flex items-start gap-3">
        <div className="bg-primary/10 text-primary flex h-10 w-10 shrink-0 items-center justify-center rounded-xl">
          <CalendarDays className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-muted-foreground text-[11px] font-semibold uppercase tracking-[0.16em]">
            {event.title ?? "Recommended programs"}
          </p>
          <p className="text-foreground mt-1 text-sm font-semibold">
            Public program matches
          </p>
        </div>
      </div>

      <div className="grid gap-3">
        {event.recommendations.map((program) => {
          const programPath = `${NAV_PATHS.ROUTINE_PROGRAMS}/${program.id}`;
          const metadata = [
            program.category,
            program.author,
            program.sourceLabel,
          ].filter(Boolean);

          return (
            <div
              key={program.id}
              className="border-border/50 bg-background/80 rounded-xl border p-3"
            >
              <p className="text-foreground text-sm font-semibold">{program.name}</p>
              {metadata.length > 0 && (
                <p className="text-muted-foreground mt-1 text-xs">
                  {metadata.join(" · ")}
                </p>
              )}
              <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                {program.reason}
              </p>
              <div className="text-muted-foreground mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs">
                <span>{formatCount(program.dayCount, "day")}</span>
                <span>{formatCount(program.routineCount, "routine")}</span>
              </div>
              {program.dayLabelsPreview.length > 0 && (
                <p className="text-muted-foreground mt-2 line-clamp-2 text-xs">
                  {program.dayLabelsPreview.join(", ")}
                </p>
              )}
              <Button asChild variant="secondary" size="sm" className="mt-3 w-full">
                <Link to={programPath}>View program</Link>
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
