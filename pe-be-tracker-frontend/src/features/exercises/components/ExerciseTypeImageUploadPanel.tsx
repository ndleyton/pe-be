import { useRef, useState, type ChangeEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Image, Loader2, Trash2, Upload } from "lucide-react";

import {
  deleteExerciseTypeImage,
  getExerciseTypeImages,
  uploadExerciseTypeImage,
  type ExerciseTypeImage,
} from "@/features/exercises/api";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/shared/components/ui/alert";
import { Button } from "@/shared/components/ui/button";
import { Skeleton } from "@/shared/components/ui/skeleton";

interface ExerciseTypeImageUploadPanelProps {
  exerciseTypeId: number | string;
}

const getErrorMessage = (error: unknown, fallback: string): string => {
  const responseDetail = (
    error as {
      response?: { data?: { detail?: unknown } };
    }
  )?.response?.data?.detail;

  if (typeof responseDetail === "string" && responseDetail.trim()) {
    return responseDetail;
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
};

const displayNameForImage = (image: ExerciseTypeImage, index: number): string =>
  image.original_filename || `Reference image ${index + 1}`;

export const ExerciseTypeImageUploadPanel = ({
  exerciseTypeId,
}: ExerciseTypeImageUploadPanelProps) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const queryKey = ["exerciseTypeImages", String(exerciseTypeId)] as const;

  const {
    data,
    isLoading,
    error: listError,
  } = useQuery({
    queryKey,
    queryFn: () => getExerciseTypeImages(exerciseTypeId),
  });

  const refreshImages = async () => {
    await queryClient.invalidateQueries({ queryKey });
    await queryClient.invalidateQueries({
      queryKey: ["exerciseType", String(exerciseTypeId)],
    });
  };

  const uploadMutation = useMutation({
    mutationFn: (file: File) => uploadExerciseTypeImage(exerciseTypeId, file),
    onMutate: () => {
      setMutationError(null);
    },
    onSuccess: refreshImages,
    onError: (error) => {
      setMutationError(
        getErrorMessage(error, "Failed to upload reference image."),
      );
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (assetId: number) =>
      deleteExerciseTypeImage(exerciseTypeId, assetId),
    onMutate: () => {
      setMutationError(null);
    },
    onSuccess: refreshImages,
    onError: (error) => {
      setMutationError(
        getErrorMessage(error, "Failed to delete reference image."),
      );
    },
  });

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || uploadMutation.isPending) {
      return;
    }
    uploadMutation.mutate(file);
  };

  const images = data?.images ?? [];

  return (
    <div className="bg-card border-border/20 mb-6 rounded-2xl border p-6 text-left shadow-md">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Reference Images</h2>
          <p className="text-muted-foreground text-sm">
            Private reference images for admin review. The final exercise image is
            selected before release.
          </p>
        </div>
        <div>
          <input
            ref={fileInputRef}
            type="file"
            className="sr-only"
            accept="image/png,image/jpeg,image/webp"
            onChange={handleFileChange}
            aria-label="Upload reference image"
          />
          <Button
            type="button"
            className="w-full rounded-xl bg-primary/95 font-bold shadow-lg shadow-primary/10 sm:w-auto"
            disabled={uploadMutation.isPending}
            onClick={() => fileInputRef.current?.click()}
          >
            {uploadMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Uploading
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Upload Image
              </>
            )}
          </Button>
        </div>
      </div>

      {listError ? (
        <Alert variant="destructive" className="mb-4">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            {getErrorMessage(listError, "Failed to load reference images.")}
          </AlertDescription>
        </Alert>
      ) : null}

      {mutationError ? (
        <Alert variant="destructive" className="mb-4">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{mutationError}</AlertDescription>
        </Alert>
      ) : null}

      {isLoading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Skeleton className="aspect-square rounded-xl" />
          <Skeleton className="aspect-square rounded-xl" />
          <Skeleton className="aspect-square rounded-xl" />
        </div>
      ) : images.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {images.map((image, index) => (
            <div
              key={`${image.id ?? image.url}-${image.url}`}
              className="group relative overflow-hidden rounded-xl border border-border/40 bg-muted/30"
            >
              <div className="aspect-square">
                <img
                  src={image.url}
                  alt={displayNameForImage(image, index)}
                  className="h-full w-full object-cover"
                />
              </div>
              {image.id != null ? (
                <Button
                  type="button"
                  size="icon"
                  variant="destructive"
                  className="absolute right-2 top-2 h-8 w-8 rounded-full opacity-95"
                  aria-label={`Delete ${displayNameForImage(image, index)}`}
                  disabled={deleteMutation.isPending}
                  onClick={() => {
                    if (image.id != null) {
                      deleteMutation.mutate(image.id);
                    }
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              ) : null}
              <div className="absolute inset-x-0 bottom-0 bg-background/85 px-2 py-1 text-xs font-medium backdrop-blur">
                <span className="line-clamp-1">
                  {displayNameForImage(image, index)}
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="border-border/40 text-muted-foreground flex min-h-32 flex-col items-center justify-center rounded-xl border border-dashed p-6 text-center">
          <Image className="mb-2 h-8 w-8" />
          <p className="text-sm">No reference images uploaded.</p>
        </div>
      )}
    </div>
  );
};
