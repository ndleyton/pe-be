import { ChevronRight, ExternalLink, MoreVertical, StickyNote } from "lucide-react";
import { Link } from "react-router-dom";

import type { Exercise, IntensityUnit } from "@/features/exercises/api";
import type { GuestIntensityUnit } from "@/features/exercises/lib/intensityUnits";
import { ExerciseTypeMore } from "../ExerciseTypeMore";
import { createIntentPreload } from "@/shared/lib/createIntentPreload";
import { cn } from "@/lib/utils";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Textarea,
} from "@/shared/components/ui";

const preloadExerciseTypeDetailsPage = createIntentPreload(() =>
  import("@/features/exercises/pages"),
);

type ExerciseRowHeaderProps = {
  currentIntensityUnit: IntensityUnit | GuestIntensityUnit;
  exercise: Exercise;
  exerciseNotesOpen: boolean;
  exerciseNotesValue: string;
  exerciseSettingsOpen: boolean;
  isUnsavedExercise: boolean;
  isExpanded: boolean;
  onToggleExpand: () => void;
  hasImages: boolean;
  onExerciseDelete: () => void | Promise<void>;
  onExerciseNotesOpen: () => void;
  onExerciseNotesOpenChange: (open: boolean) => void;
  onExerciseNotesSave: () => void;
  onExerciseNotesValueChange: (value: string) => void;
  onExerciseSettingsOpenChange: (open: boolean) => void;
  onIntensityUnitChange: (unit: IntensityUnit | GuestIntensityUnit) => void;
};

export const ExerciseRowHeader = ({
  currentIntensityUnit,
  exercise,
  exerciseNotesOpen,
  exerciseNotesValue,
  exerciseSettingsOpen,
  isUnsavedExercise,
  isExpanded,
  onToggleExpand,
  hasImages,
  onExerciseDelete,
  onExerciseNotesOpen,
  onExerciseNotesOpenChange,
  onExerciseNotesSave,
  onExerciseNotesValueChange,
  onExerciseSettingsOpenChange,
  onIntensityUnitChange,
}: ExerciseRowHeaderProps) => {
  const showExerciseTypeDetailsLink =
    typeof exercise.exercise_type.id === "number" &&
    (exercise.exercise_type.status ?? "released") === "released";

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        {hasImages && (
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg p-0 transition-colors duration-300 active:scale-90",
              isExpanded
                ? "bg-rose-500 text-primary-foreground hover:bg-rose-500/90"
                : "bg-primary text-primary-foreground hover:bg-primary/90",
            )}
            aria-label={isExpanded ? "Hide exercise images" : "Show exercise images"}
            onClick={onToggleExpand}
            aria-expanded={isExpanded}
          >
            <ChevronRight
              className={cn(
                "h-4 w-4 transition-transform duration-300",
                isExpanded ? "rotate-90" : "rotate-0",
              )}
            />
          </Button>
        )}
        {!hasImages && (
          <div className="bg-primary flex h-8 w-8 items-center justify-center rounded-lg transition-transform duration-300">
            <span className="text-primary-foreground text-sm font-bold">
              {exercise.exercise_type.name.charAt(0).toUpperCase()}
            </span>
          </div>
        )}
        <div className="flex items-center gap-2">
          <h3 className="text-foreground font-semibold">
            {exercise.exercise_type.name}
          </h3>
          <Dialog
            open={exerciseNotesOpen}
            onOpenChange={onExerciseNotesOpenChange}
          >
            <DialogTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="hover:bg-accent hover:text-accent-foreground h-6 w-6 p-0 dark:hover:bg-gray-700"
                onClick={onExerciseNotesOpen}
              >
                <StickyNote className="h-4 w-4 text-gray-600 dark:text-gray-400" />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Exercise Notes</DialogTitle>
                <DialogDescription>
                  Save notes that apply to the whole exercise.
                </DialogDescription>
              </DialogHeader>
              <Textarea
                placeholder="Add notes for this exercise..."
                value={exerciseNotesValue}
                onChange={(event) => onExerciseNotesValueChange(event.target.value)}
                className="min-h-[100px]"
              />
              <div className="flex justify-end gap-2">
                <Button
                  variant="glass"
                  onClick={() => onExerciseNotesOpenChange(false)}
                >
                  Cancel
                </Button>
                <Button onClick={onExerciseNotesSave}>Save</Button>
              </div>
            </DialogContent>
          </Dialog>
          {showExerciseTypeDetailsLink && (
            <Button
              variant="ghost"
              size="sm"
              className="hover:bg-accent hover:text-accent-foreground h-6 w-6 p-0 dark:hover:bg-gray-700"
              asChild
              onMouseEnter={preloadExerciseTypeDetailsPage}
              onTouchStart={preloadExerciseTypeDetailsPage}
              onFocus={preloadExerciseTypeDetailsPage}
            >
              <Link
                to={`/exercise-types/${exercise.exercise_type.id}`}
                aria-label={`View details for ${exercise.exercise_type.name}`}
                title="View exercise details"
              >
                <ExternalLink className="h-4 w-4 text-gray-600 dark:text-gray-400" />
              </Link>
            </Button>
          )}
        </div>
      </div>

      <Dialog
        open={exerciseSettingsOpen}
        onOpenChange={onExerciseSettingsOpenChange}
      >
        <DialogTrigger asChild>
          <Button variant="ghost" size="sm">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Exercise Settings</DialogTitle>
            <DialogDescription>
              Adjust the active intensity unit or delete this exercise.
            </DialogDescription>
          </DialogHeader>
          <ExerciseTypeMore
            currentIntensityUnit={currentIntensityUnit}
            onIntensityUnitChange={onIntensityUnitChange}
            onExerciseDelete={onExerciseDelete}
            disableExerciseDelete={isUnsavedExercise}
            onClose={() => onExerciseSettingsOpenChange(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
};
