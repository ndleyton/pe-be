import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  CalendarDays,
  Copy,
  Dumbbell,
  Layers3,
  Play,
} from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";

import {
  cloneRoutineProgram,
  getRoutineProgram,
} from "@/features/routines/api";
import { useStartWorkoutFromRoutine } from "@/features/routines/hooks";
import type { RoutineProgramDay } from "@/features/routines/types";
import { cn } from "@/lib/utils";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/shared/components/ui/alert";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { RoutineProgramDetailsPageSkeleton } from "@/features/routines/components";
import { useAppBackNavigation } from "@/shared/hooks";
import { useAuthStore } from "@/stores";

const DayRow = ({
  day,
  onStart,
}: {
  day: RoutineProgramDay;
  onStart: (day: RoutineProgramDay) => void;
}) => {
  const preview = day.routine.exercise_names_preview.slice(0, 3);

  return (
    <div className="group relative rounded-2xl border border-border/40 bg-card/40 p-4 shadow-sm transition-all hover:bg-card/60 hover:shadow-md">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="flex shrink-0 items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-border/40 bg-background text-xl font-black shadow-inner transition-transform group-hover:scale-105">
            {day.sort_order}
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-1 sm:hidden">
            <h2 className="truncate text-lg font-black tracking-tight">
              {day.day_label}
            </h2>
            <div className="flex flex-wrap gap-1">
              {day.week_number ? (
                <Badge
                  variant="outline"
                  className="h-4 rounded-md border-none bg-muted px-1.5 text-[8px] font-black uppercase tracking-widest text-muted-foreground"
                >
                  W{day.week_number}
                </Badge>
              ) : null}
              {day.phase_label ? (
                <Badge
                  variant="outline"
                  className="h-4 rounded-md border-none bg-primary/10 px-1.5 text-[8px] font-black uppercase tracking-widest text-primary"
                >
                  {day.phase_label}
                </Badge>
              ) : null}
            </div>
          </div>
        </div>

        <div className="min-w-0 flex-1 space-y-3">
          <div className="hidden sm:block">
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-3">
                <h2 className="truncate text-xl font-black tracking-tight">
                  {day.day_label}
                </h2>
                <div className="flex gap-1">
                  {day.week_number ? (
                    <Badge
                      variant="outline"
                      className="h-5 rounded-lg border-none bg-muted px-2 text-[9px] font-black uppercase tracking-widest text-muted-foreground"
                    >
                      Week {day.week_number}
                    </Badge>
                  ) : null}
                  {day.phase_label ? (
                    <Badge
                      variant="outline"
                      className="h-5 rounded-lg border-none bg-primary/10 px-2 text-[9px] font-black uppercase tracking-widest text-primary"
                    >
                      {day.phase_label}
                    </Badge>
                  ) : null}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <Button
                  asChild
                  variant="ghost"
                  size="sm"
                  className="h-8 rounded-xl px-3 text-[10px] font-black uppercase tracking-widest opacity-60 transition-all hover:bg-primary/10 hover:opacity-100"
                >
                  <Link to={`/routines/${day.routine_id}`}>Details</Link>
                </Button>
                <Button
                  onClick={() => onStart(day)}
                  size="sm"
                  className="h-8 rounded-xl px-4 text-[10px] font-black uppercase tracking-widest shadow-lg shadow-primary/20 transition-all active:scale-95"
                >
                  <Play className="mr-1.5 h-3 w-3 fill-current" />
                  Start
                </Button>
              </div>
            </div>
            <p className="mt-1 text-xs font-bold text-muted-foreground/60">
              {day.routine.name} • {day.routine.exercise_count} exercises •{" "}
              {day.routine.set_count} sets
            </p>
          </div>

          <div className="sm:hidden">
            <p className="text-[11px] font-bold text-muted-foreground/60">
              {day.routine.name} • {day.routine.exercise_count} ex •{" "}
              {day.routine.set_count} sets
            </p>
          </div>

          {preview.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {preview.map((name) => (
                <div
                  key={name}
                  className="rounded-lg border border-border/40 bg-muted/30 px-2 py-1 text-[10px] font-bold text-foreground/70"
                >
                  {name}
                </div>
              ))}
              {day.routine.exercise_count > 3 && (
                <div className="rounded-lg border border-border/40 bg-muted/20 px-2 py-1 text-[10px] font-bold text-muted-foreground/50">
                  +{day.routine.exercise_count - 3} more
                </div>
              )}
            </div>
          ) : null}

          {day.notes ? (
            <div className="rounded-xl border border-primary/10 bg-primary/5 p-3">
              <p className="text-[11px] font-medium leading-relaxed italic text-muted-foreground/80">
                {day.notes}
              </p>
            </div>
          ) : null}

          <div className="flex shrink-0 gap-2 sm:hidden">
            <Button
              asChild
              variant="outline"
              className="h-9 flex-1 rounded-xl text-[10px] font-black uppercase tracking-widest border-border/60"
            >
              <Link to={`/routines/${day.routine_id}`}>Details</Link>
            </Button>
            <Button
              onClick={() => onStart(day)}
              className="h-9 flex-1 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-primary/10"
            >
              <Play className="mr-1.5 h-3.5 w-3.5 fill-current" />
              Start
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

const RoutineProgramDetailsPage = () => {
  const { programId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const handleBack = useAppBackNavigation("/routines");
  const startWorkoutFromRoutine = useStartWorkoutFromRoutine();
  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  const programQuery = useQuery({
    queryKey: ["routine-program", programId],
    queryFn: () => getRoutineProgram(programId as string),
    enabled: Boolean(programId),
  });

  const cloneMutation = useMutation({
    mutationFn: () => cloneRoutineProgram(programId as string),
    onSuccess: (clonedProgram) => {
      queryClient.invalidateQueries({ queryKey: ["routine-programs"] });
      toast.success("Program saved.");
      navigate(`/routine-programs/${clonedProgram.id}`);
    },
    onError: () => {
      toast.error("Could not save program.");
    },
  });

  const program = programQuery.data;
  const canClone =
    Boolean(program) &&
    isAuthenticated &&
    program?.creator_id !== user?.id &&
    (program?.visibility === "public" || program?.visibility === "link_only");

  const handleStartDay = (day: RoutineProgramDay) => {
    startWorkoutFromRoutine({ id: day.routine_id });
  };

  if (programQuery.isPending) {
    return (
      <div className="mx-auto min-h-screen max-w-4xl px-4 py-6 md:py-8">
        <RoutineProgramDetailsPageSkeleton />
      </div>
    );
  }

  if (programQuery.error || !program) {
    return (
      <div className="container mx-auto px-4 py-6">
        <Alert variant="destructive">
          <AlertTitle>Program unavailable</AlertTitle>
          <AlertDescription>
            We couldn&apos;t load this program. It may have been deleted or you
            may not have access to it.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="mx-auto min-h-screen max-w-4xl px-4 py-6 md:py-8">
      <div className="mb-8 flex items-center gap-4 text-left">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Go back"
          type="button"
          onClick={handleBack}
          className="rounded-full bg-primary/5 transition-all duration-300 hover:bg-primary hover:text-primary-foreground"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h1 className="min-w-0 truncate bg-gradient-to-b from-foreground to-foreground/70 bg-clip-text text-3xl font-black tracking-tight text-transparent text-glow">
              {program.name}
            </h1>
            <Badge
              variant={program.visibility === "public" ? "default" : "secondary"}
              className="rounded-lg text-[10px] font-black uppercase tracking-widest"
            >
              {program.visibility === "link_only"
                ? "Link Only"
                : program.visibility}
            </Badge>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/50">
              Routine Program
            </p>
            {(program.author || program.source_label) && (
              <span className="h-1 w-1 rounded-full bg-muted-foreground/20" />
            )}
            {program.author && (
              <p className="text-[10px] font-black uppercase tracking-widest text-primary/60">
                By {program.author}
              </p>
            )}
            {program.source_label && (
              <>
                {program.author && (
                  <span className="h-1 w-1 rounded-full bg-muted-foreground/20" />
                )}
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">
                  via {program.source_label}
                </p>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-6 text-left">
        <div className="space-y-4">
          <h3 className="px-1 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/40">
            Program Overview
          </h3>
          <Card className="overflow-hidden rounded-3xl border border-border/40 bg-card/20 shadow-xl backdrop-blur-xl">
            <CardContent className="p-0">
              <div className="flex flex-col sm:flex-row sm:items-stretch">
                <div className="min-w-0 flex-1 px-6 py-5 sm:px-8 sm:py-6">
                  <p className="max-w-2xl text-lg font-medium leading-relaxed text-foreground/90">
                    {program.description || "No description provided."}
                  </p>

                  <div className="mt-8 flex flex-wrap gap-4">
                    {[
                      {
                        label: "Days",
                        value: program.days.length,
                        icon: CalendarDays,
                      },
                      {
                        label: "Exercises",
                        value: program.days.reduce(
                          (total, day) => total + day.routine.exercise_count,
                          0,
                        ),
                        icon: Dumbbell,
                      },
                      {
                        label: "Category",
                        value: program.category || "Uncategorized",
                        icon: Layers3,
                      },
                    ].map((item) => (
                      <div key={item.label} className="flex flex-col gap-1">
                        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/40">
                          <item.icon className="h-3 w-3" />
                          {item.label}
                        </div>
                        <span className="text-xl font-black tracking-tight">
                          {item.value}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {canClone ? (
                  <div className="flex shrink-0 items-center justify-center border-t border-border/10 bg-primary/5 p-6 sm:w-64 sm:border-l sm:border-t-0">
                    <Button
                      onClick={() => cloneMutation.mutate()}
                      disabled={cloneMutation.isPending}
                      className="h-14 w-full rounded-2xl px-8 font-black uppercase tracking-widest shadow-xl shadow-primary/20 transition-all hover:scale-[1.02] active:scale-95"
                    >
                      <Copy className="mr-2 h-5 w-5" />
                      {cloneMutation.isPending ? "Saving..." : "Save Program"}
                    </Button>
                  </div>
                ) : null}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/40">
              Training Schedule
            </h3>
            <Badge
              variant="outline"
              className="h-5 rounded-lg border-none bg-muted px-2 text-[9px] font-black uppercase tracking-widest text-muted-foreground/50"
            >
              {program.days.length} Days
            </Badge>
          </div>
          <div className="space-y-4">
            {program.days.map((day) => (
              <DayRow key={day.id} day={day} onStart={handleStartDay} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default RoutineProgramDetailsPage;
