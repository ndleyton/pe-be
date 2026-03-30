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
    <Card className="hover:bg-accent cursor-pointer transition-colors">
      <CardHeader>
        <div className="flex items-center space-x-3">
          <div className="bg-primary flex h-10 w-10 items-center justify-center rounded-lg">
            <span className="text-primary-foreground text-lg font-bold">
              📋
            </span>
          </div>
          <div>
            <CardTitle className="text-base">{routine.name}</CardTitle>
            <CardDescription>
              {exerciseCount} exercise{exerciseCount !== 1 ? "s" : ""} •{" "}
              {totalSets} set{totalSets !== 1 ? "s" : ""}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div>
          {routine.exercise_templates.slice(0, 3).map((exercise) => (
            <div key={exercise.id} className="text-muted-foreground text-sm">
              {exercise.exercise_type?.name ?? "Unknown Exercise"} • {exercise.set_templates.length} set
              {exercise.set_templates.length !== 1 ? "s" : ""}
            </div>
          ))}
          {routine.exercise_templates.length > 3 && (
            <div className="text-muted-foreground text-sm">
              +{routine.exercise_templates.length - 3} more exercise
              {routine.exercise_templates.length - 3 !== 1 ? "s" : ""}
            </div>
          )}
        </div>
        <div className="mt-3 flex gap-2">
          <Button
            asChild
            variant="outline"
            className="flex-1"
            size="sm"
          >
            <Link to={`/routines/${routine.id}`}>View Details</Link>
          </Button>
          <Button
            onClick={() => onStartWorkout(routine)}
            className="flex-1"
            size="sm"
          >
            Start Workout
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
