import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { uploadWorkoutPhoto } from "@/features/workouts/api";
import { prepareWorkoutPhotoFile } from "@/features/workouts/lib/workoutPhotoPreparation";
import type { Workout, WorkoutPhoto } from "@/features/workouts/types";

type UseWorkoutPhotoUploadParams = {
  isAuthenticated: boolean;
  workoutId?: string;
};

export const useWorkoutPhotoUpload = ({
  isAuthenticated,
  workoutId,
}: UseWorkoutPhotoUploadParams) => {
  const queryClient = useQueryClient();
  const previewUrlRef = useRef<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = null;
        setPreviewUrl(null);
      }
    };
  }, [workoutId]);

  const mutation = useMutation<
    WorkoutPhoto,
    Error,
    File,
    { previousPreviewUrl: string | null }
  >({
    mutationFn: async (file) => {
      if (!workoutId) {
        throw new Error("Workout id is required.");
      }

      if (!isAuthenticated) {
        throw new Error("Workout photo uploads require sign-in.");
      }

      const preparedFile = await prepareWorkoutPhotoFile(file);
      return uploadWorkoutPhoto(workoutId, preparedFile);
    },
    onMutate: async (file) => {
      const previousPreviewUrl = previewUrlRef.current;
      const nextPreviewUrl = URL.createObjectURL(file);

      previewUrlRef.current = nextPreviewUrl;
      setPreviewUrl(nextPreviewUrl);

      if (previousPreviewUrl) {
        URL.revokeObjectURL(previousPreviewUrl);
      }

      return { previousPreviewUrl };
    },
    onSuccess: (photo) => {
      if (!workoutId) {
        return;
      }

      queryClient.setQueryData<Workout | undefined>(
        ["workout", workoutId],
        (current) => (current ? { ...current, photo } : current),
      );
    },
    onError: (_error, _file, context) => {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
      }

      previewUrlRef.current = context?.previousPreviewUrl ?? null;
      setPreviewUrl(context?.previousPreviewUrl ?? null);
      toast.error("Failed to upload workout photo.");
    },
    onSettled: async () => {
      if (isAuthenticated && workoutId) {
        await queryClient.invalidateQueries({ queryKey: ["workout", workoutId] });
      }
    },
  });

  return {
    isUploadingWorkoutPhoto: mutation.isPending,
    uploadWorkoutPhoto: mutation.mutateAsync,
    workoutPhotoPreviewUrl: previewUrl,
  };
};
