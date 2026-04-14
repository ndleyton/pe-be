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
  const workouts = Array.isArray(rawWorkouts) ? rawWorkouts : [];

  const [syncStatus, setSyncStatus] = useState<PostLoginStatus>("processing");
  const [errorMessage, setErrorMessage] = useState("");
  const [guestCount, setGuestCount] = useState(0);

  useEffect(() => {
    if (!hydrated || hasStartedRef.current) {
      return;
    }

    // Once hydrated, if we have workouts, show them in the UI state
    if (guestCount === 0 && workouts.length > 0) {
      setGuestCount(workouts.length);
    }

    hasStartedRef.current = true;

    const finalizeLogin = async () => {
      try {
        setSyncStatus("processing");
        const postLoginDestination =
          consumePostLoginDestination() ?? NAV_PATHS.WORKOUTS;

        await refreshAuth();
        const { user } = useAuthStore.getState();

        if (!user) {
          throw new Error(
            "We couldn't confirm your session. Please try signing in again.",
          );
        }

        // Check workouts again here to be absolutely sure we use latest state
        const currentWorkouts = useGuestStore.getState().workouts;
        if (currentWorkouts.length > 0) {
          setGuestCount(currentWorkouts.length);
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
  }, [hydrated, navigate, refreshAuth, syncWithServer, workouts.length]);

  return {
    errorMessage,
    initialGuestWorkoutCount: guestCount,
    syncStatus,
  };
};
