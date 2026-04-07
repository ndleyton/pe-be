import type { Routine } from "@/features/routines/types";
import { Button } from "@/shared/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { Link } from "react-router-dom";
import { createIntentPreload } from "@/shared/lib/createIntentPreload";

const preloadRoutineDetailsPage = createIntentPreload(() =>
  import("@/features/routines/pages/RoutineDetailsPage"),
);

interface RoutineQuickStartCardProps {
  routine: Routine;
  onStartWorkout: (routine: Routine) => void;
}

export const RoutineQuickStartCard = ({
  routine,
  onStartWorkout,
}: RoutineQuickStartCardProps) => {
  const exerciseCount = routine.exercise_templates.length;
  const totalSets = routine.exercise_templates.reduce(
    (total, exercise) => total + exercise.set_templates.length,
    0,
  );

  return (
    <Card className="bg-card/60 border-border/40 hover:bg-card/80 relative flex w-full max-w-sm flex-col overflow-hidden rounded-2xl border shadow-xl transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl hover:shadow-primary/5 backdrop-blur-md group">
      <CardHeader className="pb-3">
        <div className="flex items-center space-x-3">
          <div className="bg-primary/10 text-primary flex h-10 w-10 items-center justify-center rounded-xl font-bold shadow-inner group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-300">
            <span className="text-lg">📋</span>
          </div>
          <div>
            <CardTitle className="text-base font-black tracking-tight">{routine.name}</CardTitle>
            <CardDescription className="text-xs font-medium opacity-70">
              {exerciseCount} exercise{exerciseCount !== 1 ? "s" : ""} •{" "}
              {totalSets} set{totalSets !== 1 ? "s" : ""}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0 pb-6">
        <div className="space-y-1 mb-5">
          {routine.exercise_templates.slice(0, 3).map((exercise) => (
            <div key={exercise.id} className="text-muted-foreground text-[11px] font-medium leading-tight flex items-center gap-1.5">
              <div className="h-1 w-1 rounded-full bg-primary/30" />
              <span className="truncate">{exercise.exercise_type?.name ?? "Unknown Exercise"}</span>
            </div>
          ))}
          {routine.exercise_templates.length > 3 && (
            <div className="text-muted-foreground/60 text-[10px] font-bold uppercase tracking-wider pl-2.5 pt-1">
              +{routine.exercise_templates.length - 3} more
            </div>
          )}
        </div>
        <div className="mt-auto flex gap-3">
          <Button
            asChild
            variant="outline"
            className="flex-1 rounded-xl text-xs font-bold transition-all hover:bg-accent/50 h-10 shadow-sm"
            onMouseEnter={preloadRoutineDetailsPage}
            onTouchStart={preloadRoutineDetailsPage}
            onFocus={preloadRoutineDetailsPage}
          >
            <Link to={`/routines/${routine.id}`}>Details</Link>
          </Button>
          <Button
            onClick={() => onStartWorkout(routine)}
            className="bg-primary/90 hover:bg-primary flex-1 rounded-xl text-xs font-bold shadow-lg shadow-primary/10 transition-all active:scale-95 backdrop-blur-sm border border-white/10 h-10"
          >
            Start Workout
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
