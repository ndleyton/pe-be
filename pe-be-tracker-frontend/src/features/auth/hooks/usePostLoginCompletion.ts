import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useShallow } from "zustand/react/shallow";
import { consumePostLoginDestination } from "@/features/auth/lib/postLoginRedirect";
import { NAV_PATHS } from "@/shared/navigation/constants";
import { useAuthStore, useGuestStore } from "@/stores";

export type PostLoginStatus =
  | "processing"
  | "syncing"
  | "complete"
  | "error";

interface UsePostLoginCompletionResult {
  errorMessage: string;
  initialGuestWorkoutCount: number;
  syncStatus: PostLoginStatus;
}

export const usePostLoginCompletion = (): UsePostLoginCompletionResult => {
  const navigate = useNavigate();
  const refreshAuth = useAuthStore((state) => state.refresh);
  const syncWithServer = useGuestStore((state) => state.syncWithServer);
  const { hydrated, workouts: rawWorkouts } = useGuestStore(
    useShallow((state) => ({
      hydrated: state.hydrated,
      workouts: state.workouts,
    })),
  );
  const hasStartedRef = useRef(false);
  const redirectTimeoutRef = useRef<number | null>(null);
  const initialGuestWorkoutCountRef = useRef<number | null>(null);
  const workouts = Array.isArray(rawWorkouts) ? rawWorkouts : [];
  const [syncStatus, setSyncStatus] = useState<PostLoginStatus>("processing");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!hydrated || initialGuestWorkoutCountRef.current !== null) {
      return;
    }

    initialGuestWorkoutCountRef.current = workouts.length;
  }, [hydrated, workouts.length]);

  useEffect(() => {
    if (!hydrated || initialGuestWorkoutCountRef.current === null) {
      return;
    }

    if (hasStartedRef.current) {
      return;
    }
    hasStartedRef.current = true;

    const finalizeLogin = async () => {
      try {
        setSyncStatus("processing");
        const postLoginDestination =
          consumePostLoginDestination() ?? NAV_PATHS.WORKOUTS;
        const initialGuestWorkoutCount = initialGuestWorkoutCountRef.current ?? 0;

        await refreshAuth();
        const { user } = useAuthStore.getState();

        if (!user) {
          throw new Error(
            "We couldn't confirm your session. Please try signing in again.",
          );
        }

        if (initialGuestWorkoutCount > 0) {
          setSyncStatus("syncing");
          const syncSucceeded = await syncWithServer();
          if (!syncSucceeded) {
            throw new Error("Failed to sync guest data");
          }
        }

        setSyncStatus("complete");
        await new Promise((resolve) => setTimeout(resolve, 800));

        navigate(postLoginDestination, { replace: true });
      } catch (error) {
        console.error("Post-login completion error:", error);
        const errorMsg =
          error instanceof Error ? error.message : "Authentication failed";
        setErrorMessage(errorMsg);
        setSyncStatus("error");

        redirectTimeoutRef.current = window.setTimeout(() => {
          navigate(NAV_PATHS.LOGIN, { replace: true });
        }, 3000);
      }
    };

    void finalizeLogin();

    return () => {
      if (redirectTimeoutRef.current !== null) {
        window.clearTimeout(redirectTimeoutRef.current);
      }
    };
  }, [hydrated, navigate, refreshAuth, syncWithServer]);

  return {
    errorMessage,
    initialGuestWorkoutCount: initialGuestWorkoutCountRef.current ?? 0,
    syncStatus,
  };
};
