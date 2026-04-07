import { Edit2, Play, Save, Share2, Trash2, X } from "lucide-react";
import { useState } from "react";

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
  canEdit: boolean;
  isEditing: boolean;
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
  onEdit: () => void;
  onCancel: () => void;
  saveDisabled: boolean;
  saveLabel: string;
  startDisabled: boolean;
  startLabel: string;
};

export const RoutineInfoCard = ({
  canEdit,
  isEditing,
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
  onEdit,
  onCancel,
  saveDisabled,
  saveLabel,
  startDisabled,
  startLabel,
}: RoutineInfoCardProps) => {
  const [shareCopied, setShareCopied] = useState(false);

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy URL:", err);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Routine Info</CardTitle>
        <CardDescription>
          {isEditing
            ? "Update the routine metadata and save the full template when you're ready."
            : canEdit
              ? "You own this routine. Tap Edit to make changes."
              : "This routine is view-only for your account."}
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
            readOnly={!isEditing}
            onChange={(event) => onNameChange(event.target.value)}
            placeholder="Enter routine name"
            className={!isEditing ? "bg-muted/30" : ""}
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
            readOnly={!isEditing}
            onChange={(event) => onDescriptionChange(event.target.value)}
            placeholder="Optional routine description"
            className={!isEditing ? "bg-muted/30" : ""}
          />
        </div>

        <div className="flex flex-col gap-3">
          {isEditing ? (
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
                variant="outline"
                onClick={onCancel}
                className="flex-1"
              >
                <X className="mr-2 h-4 w-4" />
                Cancel
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
          ) : (
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                data-testid="start-routine-workout-button"
                onClick={onStartWorkout}
                disabled={startDisabled}
                className="flex-1"
              >
                <Play className="mr-2 h-4 w-4" />
                {startLabel}
              </Button>
              {canEdit && (
                <Button variant="outline" onClick={onEdit} className="flex-1">
                  <Edit2 className="mr-2 h-4 w-4" />
                  Edit Routine
                </Button>
              )}
              <Button
                variant="ghost"
                onClick={handleShare}
                className="flex-1"
              >
                <Share2 className="mr-2 h-4 w-4" />
                {shareCopied ? "URL Copied!" : "Share Routine"}
              </Button>
            </div>
          )}
        </div>

        {isEditing && hasInvalidTemplates && (
          <p className="text-sm text-destructive font-medium">
            Every exercise template needs a selected exercise type and every set
            needs an intensity unit before you can save.
          </p>
        )}
      </CardContent>
    </Card>
  );
};
