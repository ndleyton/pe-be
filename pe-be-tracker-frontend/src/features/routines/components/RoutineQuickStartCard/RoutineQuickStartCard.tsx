
import { GuestRecipe } from "@/stores";
import { Button } from "@/shared/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";

interface RoutineQuickStartCardProps {
  routine: GuestRecipe;
  onStartWorkout: (routine: GuestRecipe) => void;
}

export const RoutineQuickStartCard = ({
  routine,
  onStartWorkout,
}: RoutineQuickStartCardProps) => {
  const exerciseCount = routine.exercises.length;
  const totalSets = routine.exercises.reduce(
    (total, exercise) => total + exercise.sets.length,
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
          {routine.exercises.slice(0, 3).map((exercise) => (
            <div key={exercise.id} className="text-muted-foreground text-sm">
              {exercise.exercise_type.name} • {exercise.sets.length} set
              {exercise.sets.length !== 1 ? "s" : ""}
            </div>
          ))}
          {routine.exercises.length > 3 && (
            <div className="text-muted-foreground text-sm">
              +{routine.exercises.length - 3} more exercise
              {routine.exercises.length - 3 !== 1 ? "s" : ""}
            </div>
          )}
        </div>
        <Button
          onClick={() => onStartWorkout(routine)}
          className="mt-2 w-full"
          size="sm"
        >
          Start Workout
        </Button>
      </CardContent>
    </Card>
  );
};
