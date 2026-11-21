import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { consumePostLoginDestination } from "@/features/auth/lib/postLoginRedirect";
import { NAV_PATHS } from "@/shared/navigation/constants";
import { useAuthStore, useGuestStore } from "@/stores";
import { getSyncableGuestWorkouts } from "@/utils/syncGuestData";

export type PostLoginStatus =
  | "processing"
  | "syncing"
  | "complete"
  | "error";

interface UsePostLoginCompletionResult {
  errorMessage: string;
  initialGuestWorkoutCount: number;
  /** Workouts the server imported in this sign-in. */
  syncedWorkoutCount: number;
  /** Guest workouts still stored on this device after sync. */
  keptWorkoutCount: number;
  syncStatus: PostLoginStatus;
}

export const usePostLoginCompletion = (): UsePostLoginCompletionResult => {
  const navigate = useNavigate();
  const refreshAuth = useAuthStore((state) => state.refresh);
  const syncWithServer = useGuestStore((state) => state.syncWithServer);
  const hydrated = useGuestStore((state) => state.hydrated);
  const hasStartedRef = useRef(false);
  const redirectTimeoutRef = useRef<number | null>(null);

  const [syncStatus, setSyncStatus] = useState<PostLoginStatus>("processing");
  const [errorMessage, setErrorMessage] = useState("");
  const [guestCount, setGuestCount] = useState(0);
  const [syncedWorkoutCount, setSyncedWorkoutCount] = useState(0);
  const [keptWorkoutCount, setKeptWorkoutCount] = useState(0);

  useEffect(() => {
    if (!hydrated || hasStartedRef.current) {
      return;
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

        const syncableWorkouts = getSyncableGuestWorkouts(
          useGuestStore.getState(),
        );
        if (syncableWorkouts.length > 0) {
          setGuestCount(syncableWorkouts.length);
          setSyncStatus("syncing");
          const syncResult = await syncWithServer();
          if (!syncResult.success) {
            throw new Error("Failed to sync guest data");
          }
          setSyncedWorkoutCount(syncResult.syncedWorkouts);
        }
        setKeptWorkoutCount(useGuestStore.getState().workouts.length);

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
    initialGuestWorkoutCount: guestCount,
    syncedWorkoutCount,
    keptWorkoutCount,
    syncStatus,
  };
};
