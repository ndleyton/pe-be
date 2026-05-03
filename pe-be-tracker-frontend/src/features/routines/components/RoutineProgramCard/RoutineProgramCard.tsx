import { CalendarDays, Copy, Layers3 } from "lucide-react";
import { Link } from "react-router-dom";

import type { RoutineProgramSummary } from "@/features/routines/types";
import { cn } from "@/lib/utils";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";

interface RoutineProgramCardProps {
  program: RoutineProgramSummary;
  className?: string;
}

export const RoutineProgramCard = ({
  program,
  className,
}: RoutineProgramCardProps) => {
  const previewLabels = program.day_labels_preview.slice(0, 4);
  const hiddenDayCount = Math.max(0, program.day_count - previewLabels.length);

  return (
    <Card
      className={cn(
        "bg-card/90 border-border/40 hover:bg-card relative flex min-h-[17rem] w-full max-w-sm flex-col overflow-hidden rounded-2xl border py-4 shadow-xl transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl hover:shadow-primary/5",
        className,
      )}
    >
      <CardHeader className="min-h-[6rem] shrink-0 pb-1.5">
        <div className="flex items-start gap-3">
          <div className="bg-primary/10 text-primary flex h-10 w-10 shrink-0 items-center justify-center rounded-xl shadow-inner">
            <Layers3 className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex min-w-0 flex-wrap items-center gap-1.5">
              <CardTitle
                className="line-clamp-2 break-words text-base font-black leading-tight tracking-tight"
                title={program.name}
              >
                {program.name}
              </CardTitle>
              {program.visibility !== "public" ? (
                <Badge variant="secondary" className="rounded-md text-[10px]">
                  {program.visibility === "link_only" ? "Link" : "Private"}
                </Badge>
              ) : null}
            </div>
            <CardDescription className="text-xs font-medium opacity-70">
              {program.day_count} day{program.day_count !== 1 ? "s" : ""} •{" "}
              {program.exercise_count} exercise
              {program.exercise_count !== 1 ? "s" : ""}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col pt-0 pb-3">
        <div className="mb-3 flex min-h-[3.75rem] flex-wrap content-end gap-1.5">
          {previewLabels.map((label) => (
            <Badge
              key={label}
              variant="outline"
              className="max-w-full rounded-lg border-primary/15 bg-primary/5 px-2 py-1 text-[11px] font-bold"
            >
              <span className="truncate">{label}</span>
            </Badge>
          ))}
          {hiddenDayCount > 0 ? (
            <Badge
              variant="outline"
              className="rounded-lg border-border/50 px-2 py-1 text-[11px] font-bold"
            >
              +{hiddenDayCount}
            </Badge>
          ) : null}
        </div>

        <div className="mb-4 grid grid-cols-2 gap-2 text-left text-[11px] font-bold text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <CalendarDays className="h-3.5 w-3.5 text-primary" />
            <span>{program.routine_count} routines</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Copy className="h-3.5 w-3.5 text-primary" />
            <span>{program.times_used} saves</span>
          </div>
        </div>

        <Button
          asChild
          className="mt-auto h-10 rounded-xl text-xs font-bold shadow-lg shadow-primary/10"
        >
          <Link to={`/routine-programs/${program.id}`}>Open Program</Link>
        </Button>
      </CardContent>
    </Card>
  );
};
