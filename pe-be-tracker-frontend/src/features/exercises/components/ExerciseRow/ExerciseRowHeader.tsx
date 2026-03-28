import { ExternalLink, MoreVertical, StickyNote } from "lucide-react";
import { Link } from "react-router-dom";

import type { Exercise, IntensityUnit } from "@/features/exercises/api";
import type { GuestIntensityUnit } from "@/features/exercises/lib/exerciseRow";
import { ExerciseTypeMore } from "../ExerciseTypeMore";
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

type ExerciseRowHeaderProps = {
  currentIntensityUnit: IntensityUnit | GuestIntensityUnit;
  exercise: Exercise;
  exerciseNotesOpen: boolean;
  exerciseNotesValue: string;
  exerciseSettingsOpen: boolean;
  isUnsavedExercise: boolean;
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
  onExerciseDelete,
  onExerciseNotesOpen,
  onExerciseNotesOpenChange,
  onExerciseNotesSave,
  onExerciseNotesValueChange,
  onExerciseSettingsOpenChange,
  onIntensityUnitChange,
}: ExerciseRowHeaderProps) => (
  <div className="flex items-center justify-between">
    <div className="flex items-center gap-3">
      <div className="bg-primary flex h-8 w-8 items-center justify-center rounded-lg">
        <span className="text-primary-foreground text-sm font-bold">
          {exercise.exercise_type.name.charAt(0).toUpperCase()}
        </span>
      </div>
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
                variant="outline"
                onClick={() => onExerciseNotesOpenChange(false)}
              >
                Cancel
              </Button>
              <Button onClick={onExerciseNotesSave}>Save</Button>
            </div>
          </DialogContent>
        </Dialog>
        <Button
          variant="ghost"
          size="sm"
          className="hover:bg-accent hover:text-accent-foreground h-6 w-6 p-0 dark:hover:bg-gray-700"
          asChild
        >
          <Link
            to={`/exercise-types/${exercise.exercise_type.id}`}
            aria-label={`View details for ${exercise.exercise_type.name}`}
            title="View exercise details"
          >
            <ExternalLink className="h-4 w-4 text-gray-600 dark:text-gray-400" />
          </Link>
        </Button>
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
