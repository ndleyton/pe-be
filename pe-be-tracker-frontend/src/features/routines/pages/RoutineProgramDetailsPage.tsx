import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  CalendarDays,
  Copy,
  Dumbbell,
  Layers3,
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
import { RoutineDetailsPageSkeleton } from "@/features/routines/components";
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
    <div className="group relative rounded-2xl border border-border/40 bg-muted/20 p-4 shadow-sm transition-all hover:bg-muted/30">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="flex shrink-0 flex-row items-center gap-4 sm:flex-col sm:items-start">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-border/40 bg-background text-2xl font-black shadow-inner">
            {day.sort_order}
          </div>
          <div className="flex flex-wrap gap-1 sm:flex-col">
            {day.week_number ? (
              <Badge
                variant="outline"
                className="rounded-lg bg-background/50 text-[9px] font-black uppercase tracking-widest"
              >
                Week {day.week_number}
              </Badge>
            ) : null}
            {day.phase_label ? (
              <Badge
                variant="outline"
                className="rounded-lg bg-primary/5 text-[9px] font-black uppercase tracking-widest text-primary"
              >
                {day.phase_label}
              </Badge>
            ) : null}
          </div>
        </div>

        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <div className="flex items-center justify-between gap-2">
              <h2 className="truncate text-xl font-black tracking-tight">
                {day.day_label}
              </h2>
              <div className="hidden shrink-0 items-center gap-1 sm:flex">
                <Button
                  asChild
                  variant="ghost"
                  size="sm"
                  className="h-8 rounded-xl px-3 text-xs font-bold transition-all hover:bg-primary/10 hover:text-primary"
                >
                  <Link to={`/routines/${day.routine_id}`}>Details</Link>
                </Button>
                <Button
                  onClick={() => onStart(day)}
                  size="sm"
                  className="h-8 rounded-xl px-4 text-xs font-black uppercase tracking-widest transition-all active:scale-95"
                >
                  <Dumbbell className="mr-1.5 h-3.5 w-3.5" />
                  Start
                </Button>
              </div>
            </div>
            <p className="mt-0.5 text-sm font-bold text-muted-foreground/80">
              {day.routine.name} • {day.routine.exercise_count} exercise
              {day.routine.exercise_count !== 1 ? "s" : ""} •{" "}
              {day.routine.set_count} set
              {day.routine.set_count !== 1 ? "s" : ""}
            </p>
          </div>

          {preview.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {preview.map((name) => (
                <div
                  key={name}
                  className="rounded-lg border border-primary/20 bg-primary/5 px-2 py-1 text-[11px] font-bold text-foreground/80 backdrop-blur-sm"
                >
                  {name}
                </div>
              ))}
              {day.routine.exercise_count > 3 && (
                <div className="rounded-lg border border-border/40 bg-background/50 px-2 py-1 text-[11px] font-bold text-muted-foreground">
                  +{day.routine.exercise_count - 3} more
                </div>
              )}
            </div>
          ) : null}

          {day.notes ? (
            <div className="rounded-xl border border-primary/10 bg-primary/5 p-3">
              <p className="text-xs font-medium leading-relaxed italic text-muted-foreground">
                {day.notes}
              </p>
            </div>
          ) : null}

          <div className="flex shrink-0 gap-2 sm:hidden">
            <Button
              asChild
              variant="outline"
              className="h-10 flex-1 rounded-xl text-xs font-bold"
            >
              <Link to={`/routines/${day.routine_id}`}>Details</Link>
            </Button>
            <Button
              onClick={() => onStart(day)}
              className="h-10 flex-1 rounded-xl text-xs font-black uppercase tracking-widest"
            >
              <Dumbbell className="mr-1.5 h-4 w-4" />
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
        <RoutineDetailsPageSkeleton />
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

      <div className="space-y-8 text-left">
        <Card className="overflow-hidden rounded-3xl border border-border/40 bg-card/50 shadow-xl backdrop-blur-md">
          <CardContent className="p-6">
            <div className="mb-8 flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 flex-1">
                <p className="max-w-2xl text-base font-medium leading-relaxed text-foreground/90">
                  {program.description || "No description provided."}
                </p>
              </div>
              {canClone ? (
                <Button
                  onClick={() => cloneMutation.mutate()}
                  disabled={cloneMutation.isPending}
                  className="h-11 rounded-xl font-black uppercase tracking-widest shadow-lg shadow-primary/20 transition-all active:scale-95"
                >
                  <Copy className="mr-2 h-4 w-4" />
                  {cloneMutation.isPending ? "Saving..." : "Save Program"}
                </Button>
              ) : null}
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
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
                <div
                  key={item.label}
                  className="relative overflow-hidden rounded-2xl border border-border/40 bg-muted/30 p-4 transition-all hover:bg-muted/50"
                >
                  <div className="mb-3 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">
                    <item.icon className="h-3.5 w-3.5 text-primary/70" />
                    {item.label}
                  </div>
                  <div
                    className={cn(
                      "truncate text-2xl font-black tracking-tight",
                      typeof item.value !== "number" && "text-sm",
                    )}
                    title={String(item.value)}
                  >
                    {item.value}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-sm font-black uppercase tracking-[0.2em] text-muted-foreground/60">
              Training Schedule
            </h3>
            <Badge variant="secondary" className="rounded-full text-[10px]">
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
