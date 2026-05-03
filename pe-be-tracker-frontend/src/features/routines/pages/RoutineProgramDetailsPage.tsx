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
    <Card className="rounded-2xl border-border/50 bg-card/90 shadow-sm">
      <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1 text-left">
          <div className="mb-2 flex min-w-0 flex-wrap items-center gap-2">
            <Badge className="rounded-lg px-2 py-1 text-[10px] font-black">
              Day {day.sort_order}
            </Badge>
            {day.week_number ? (
              <Badge variant="outline" className="rounded-lg text-[10px]">
                Week {day.week_number}
              </Badge>
            ) : null}
            {day.phase_label ? (
              <Badge variant="outline" className="rounded-lg text-[10px]">
                {day.phase_label}
              </Badge>
            ) : null}
          </div>
          <h2 className="truncate text-lg font-black tracking-tight">
            {day.day_label}
          </h2>
          <p className="text-sm font-semibold text-muted-foreground">
            {day.routine.name} • {day.routine.exercise_count} exercise
            {day.routine.exercise_count !== 1 ? "s" : ""} •{" "}
            {day.routine.set_count} set
            {day.routine.set_count !== 1 ? "s" : ""}
          </p>
          {preview.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {preview.map((name) => (
                <Badge
                  key={name}
                  variant="outline"
                  className="max-w-full rounded-lg bg-primary/5 text-[11px]"
                >
                  <span className="truncate">{name}</span>
                </Badge>
              ))}
            </div>
          ) : null}
          {day.notes ? (
            <p className="mt-3 text-sm text-muted-foreground">{day.notes}</p>
          ) : null}
        </div>

        <div className="flex shrink-0 gap-2 sm:flex-col">
          <Button
            asChild
            variant="outline"
            className="h-10 flex-1 rounded-xl text-xs font-bold sm:w-32"
          >
            <Link to={`/routines/${day.routine_id}`}>Details</Link>
          </Button>
          <Button
            onClick={() => onStart(day)}
            className="h-10 flex-1 rounded-xl text-xs font-bold sm:w-32"
          >
            <Dumbbell className="mr-1.5 h-4 w-4" />
            Start
          </Button>
        </div>
      </CardContent>
    </Card>
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
              {program.visibility === "link_only" ? "Link Only" : program.visibility}
            </Badge>
          </div>
          <p className="mt-1 text-xs font-bold uppercase tracking-widest text-muted-foreground/70">
            Routine Program
          </p>
        </div>
      </div>

      <div className="space-y-6 text-left">
        <Card className="rounded-2xl border-border/50 bg-card/90 shadow-xl">
          <CardHeader>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle className="mb-2 flex items-center gap-2 text-2xl font-black">
                  <Layers3 className="h-5 w-5 text-primary" />
                  {program.name}
                </CardTitle>
                <CardDescription className="max-w-2xl text-sm">
                  {program.description || "No description provided."}
                </CardDescription>
              </div>
              {canClone ? (
                <Button
                  onClick={() => cloneMutation.mutate()}
                  disabled={cloneMutation.isPending}
                  className="h-11 rounded-xl font-bold"
                >
                  <Copy className="mr-2 h-4 w-4" />
                  {cloneMutation.isPending ? "Saving..." : "Save Program"}
                </Button>
              ) : null}
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-4">
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
                  label: "Saves",
                  value: program.times_used,
                  icon: Copy,
                },
                {
                  label: "Category",
                  value: program.category || "Uncategorized",
                  icon: Layers3,
                },
              ].map((item) => (
                <div
                  key={item.label}
                  className="rounded-2xl border border-border/40 bg-background/60 p-3"
                >
                  <div className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-widest text-muted-foreground">
                    <item.icon className="h-3.5 w-3.5 text-primary" />
                    {item.label}
                  </div>
                  <div
                    className={cn(
                      "truncate text-lg font-black",
                      typeof item.value !== "number" && "text-sm",
                    )}
                    title={String(item.value)}
                  >
                    {item.value}
                  </div>
                </div>
              ))}
            </div>
            {program.author || program.source_label ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {program.author ? (
                  <Badge variant="outline" className="rounded-lg">
                    {program.author}
                  </Badge>
                ) : null}
                {program.source_label ? (
                  <Badge variant="outline" className="rounded-lg">
                    {program.source_label}
                  </Badge>
                ) : null}
              </div>
            ) : null}
          </CardContent>
        </Card>

        <div className="space-y-3">
          {program.days.map((day) => (
            <DayRow key={day.id} day={day} onStart={handleStartDay} />
          ))}
        </div>
      </div>
    </div>
  );
};

export default RoutineProgramDetailsPage;
