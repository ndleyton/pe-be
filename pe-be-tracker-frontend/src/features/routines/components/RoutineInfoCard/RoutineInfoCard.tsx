import { Play, Save, Trash2 } from "lucide-react";

import { Button } from "@/shared/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";
import { Textarea } from "@/shared/components/ui/textarea";

type RoutineInfoCardProps = {
  deleteDisabled: boolean;
  deleteLabel: string;
  description: string;
  hasInvalidTemplates: boolean;
  name: string;
  onDelete: () => void;
  onDescriptionChange: (value: string) => void;
  onNameChange: (value: string) => void;
  onSave: () => void;
  onStartWorkout: () => void;
  saveDisabled: boolean;
  saveLabel: string;
  startDisabled: boolean;
  startLabel: string;
};

export const RoutineInfoCard = ({
  deleteDisabled,
  deleteLabel,
  description,
  hasInvalidTemplates,
  name,
  onDelete,
  onDescriptionChange,
  onNameChange,
  onSave,
  onStartWorkout,
  saveDisabled,
  saveLabel,
  startDisabled,
  startLabel,
}: RoutineInfoCardProps) => (
  <Card>
    <CardHeader>
      <CardTitle>Routine Info</CardTitle>
      <CardDescription>
        Update the routine metadata and save the full template when you&apos;re
        ready.
      </CardDescription>
    </CardHeader>
    <CardContent className="grid gap-4">
      <div className="grid gap-2">
        <label htmlFor="routine-name" className="text-sm font-medium">
          Routine Name
        </label>
        <Input
          id="routine-name"
          data-testid="routine-name-input"
          value={name}
          onChange={(event) => onNameChange(event.target.value)}
          placeholder="Enter routine name"
        />
      </div>

      <div className="grid gap-2">
        <label htmlFor="routine-description" className="text-sm font-medium">
          Description
        </label>
        <Textarea
          id="routine-description"
          data-testid="routine-description-input"
          value={description}
          onChange={(event) => onDescriptionChange(event.target.value)}
          placeholder="Optional routine description"
        />
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          data-testid="save-routine-button"
          onClick={onSave}
          disabled={saveDisabled}
          className="flex-1"
        >
          <Save className="mr-2 h-4 w-4" />
          {saveLabel}
        </Button>
        <Button
          data-testid="start-routine-workout-button"
          onClick={onStartWorkout}
          disabled={startDisabled}
          variant="outline"
          className="flex-1"
        >
          <Play className="mr-2 h-4 w-4" />
          {startLabel}
        </Button>
        <Button
          data-testid="delete-routine-button"
          onClick={onDelete}
          disabled={deleteDisabled}
          variant="destructive"
          className="flex-1"
        >
          <Trash2 className="mr-2 h-4 w-4" />
          {deleteLabel}
        </Button>
      </div>

      {hasInvalidTemplates && (
        <p className="text-sm text-muted-foreground">
          Every exercise template needs a selected exercise type and every set
          needs an intensity unit before you can save.
        </p>
      )}
    </CardContent>
  </Card>
);
