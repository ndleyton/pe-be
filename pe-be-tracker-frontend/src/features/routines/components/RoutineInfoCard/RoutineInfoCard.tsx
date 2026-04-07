import { Edit2, Play, Save, Share2, Trash2, X } from "lucide-react";
import { useState } from "react";
import type { RoutineVisibility } from "@/features/routines/types";

import { Button } from "@/shared/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { Textarea } from "@/shared/components/ui/textarea";

type RoutineInfoCardProps = {
  canEdit: boolean;
  editDisabled?: boolean;
  editLabel?: string;
  isEditing: boolean;
  deleteDisabled: boolean;
  deleteLabel: string;
  description: string;
  hasInvalidTemplates: boolean;
  name: string;
  visibility: RoutineVisibility;
  onDelete: () => void;
  onDescriptionChange: (value: string) => void;
  onNameChange: (value: string) => void;
  onVisibilityChange: (value: RoutineVisibility) => void;
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
  editDisabled = false,
  editLabel = "Edit Routine",
  isEditing,
  deleteDisabled,
  deleteLabel,
  description,
  hasInvalidTemplates,
  name,
  visibility,
  onDelete,
  onDescriptionChange,
  onNameChange,
  onVisibilityChange,
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
    <Card className="bg-card/80 border-border/40 rounded-2xl border p-2 text-left shadow-xl backdrop-blur-md overflow-hidden">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-lg">📋</span>
          <h4 className="text-xs font-bold uppercase tracking-wider opacity-70">
            Routine Overview
          </h4>
        </div>
        <CardTitle className="text-xl font-bold tracking-tight">
          {isEditing ? "Modify Routine Details" : name || "Untitled Routine"}
        </CardTitle>
        {description && !isEditing && (
          <p className="text-muted-foreground text-sm leading-relaxed italic mt-2">
            &ldquo;{description}&rdquo;
          </p>
        )}
      </CardHeader>
      <CardContent className="grid gap-6">
        {isEditing && (
          <>
            <div className="grid gap-2">
              <label htmlFor="routine-name" className="text-[10px] font-black uppercase tracking-widest opacity-50 ml-1">
                Routine Name
              </label>
              <Input
                id="routine-name"
                data-testid="routine-name-input"
                value={name}
                onChange={(event) => onNameChange(event.target.value)}
                placeholder="Enter routine name"
                className="h-12 rounded-xl bg-primary/5 border-primary/10 focus:border-primary/30 transition-all font-semibold"
              />
            </div>

            <div className="grid gap-2">
              <label htmlFor="routine-description" className="text-[10px] font-black uppercase tracking-widest opacity-50 ml-1">
                Description
              </label>
              <Textarea
                id="routine-description"
                data-testid="routine-description-input"
                value={description}
                onChange={(event) => onDescriptionChange(event.target.value)}
                placeholder="Optional routine description"
                className="min-h-[100px] rounded-xl bg-primary/5 border-primary/10 focus:border-primary/30 transition-all italic text-sm"
              />
            </div>

            <div className="grid gap-2">
              <label className="text-[10px] font-black uppercase tracking-widest opacity-50 ml-1">
                Visibility
              </label>
              <Select
                value={visibility}
                onValueChange={(value) =>
                  onVisibilityChange(value as RoutineVisibility)}
              >
                <SelectTrigger className="h-12 rounded-xl bg-primary/5 border-primary/10 focus:border-primary/30 transition-all font-semibold">
                  <SelectValue placeholder="Select visibility" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="private">Private</SelectItem>
                  <SelectItem value="link_only">Share by link</SelectItem>
                  <SelectItem value="public">Public</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </>
        )}

        <div className="flex flex-col gap-3 pt-2">
          {isEditing ? (
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button
                data-testid="save-routine-button"
                onClick={onSave}
                disabled={saveDisabled}
                className="h-12 flex-1 rounded-xl bg-primary shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-all font-bold"
              >
                <Save className="mr-2 h-4 w-4" />
                {saveLabel}
              </Button>
              <Button
                variant="outline"
                onClick={onCancel}
                className="h-12 flex-1 rounded-xl border-border/60 hover:bg-muted font-bold transition-all"
              >
                <X className="mr-2 h-4 w-4" />
                Cancel
              </Button>
              <Button
                data-testid="delete-routine-button"
                onClick={onDelete}
                disabled={deleteDisabled}
                variant="ghost"
                className="h-12 flex-1 rounded-xl text-destructive hover:bg-destructive/10 hover:text-destructive font-bold transition-all"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                {deleteLabel}
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button
                data-testid="start-routine-workout-button"
                onClick={onStartWorkout}
                disabled={startDisabled}
                className="h-14 flex-1 rounded-xl bg-primary shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-all text-sm font-black uppercase tracking-tight"
              >
                <Play className="mr-2 h-4 w-4 fill-current" />
                {startLabel}
              </Button>
              {canEdit && (
                <Button 
                  variant="outline" 
                  onClick={onEdit} 
                  disabled={editDisabled}
                  className="h-14 flex-1 rounded-xl border-primary/20 bg-primary/5 hover:bg-primary/10 font-bold transition-all text-xs uppercase tracking-widest"
                >
                  <Edit2 className="mr-2 h-3 w-3" />
                  {editLabel}
                </Button>
              )}
              <Button
                variant="ghost"
                onClick={handleShare}
                className="h-14 flex-1 rounded-xl hover:bg-muted font-bold transition-all text-xs uppercase tracking-widest opacity-70 hover:opacity-100"
              >
                <Share2 className="mr-2 h-3 w-3" />
                {shareCopied ? "Copied!" : "Share Link"}
              </Button>
            </div>
          )}
        </div>

        {isEditing && hasInvalidTemplates && (
          <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 mt-2">
            <p className="text-[11px] text-destructive font-black uppercase tracking-widest flex items-center gap-2">
              <span className="text-sm">⚠️</span> Missing Requirements
            </p>
            <p className="text-xs text-destructive/80 mt-1">
              Every exercise needs a type and every set needs an intensity unit before saving.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
