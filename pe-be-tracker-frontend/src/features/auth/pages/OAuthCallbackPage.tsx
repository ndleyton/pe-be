import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { consumePostLoginDestination } from "@/features/auth/lib/postLoginRedirect";
import { HomeLogo } from "@/shared/components/layout";
import { useAuthStore, useGuestStore } from "@/stores";
import { NAV_PATHS } from "@/shared/navigation/constants";
import { useShallow } from "zustand/react/shallow";
import { CheckCircle, AlertTriangle } from "lucide-react";

const PostLoginPage = () => {
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
  const initialGuestWorkoutCountRef = useRef<number | null>(null);
  const [syncStatus, setSyncStatus] = useState<
    "processing" | "syncing" | "complete" | "error"
  >("processing");
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

  const getStatusContent = () => {
    switch (syncStatus) {
      case "processing":
        return {
          icon: (
            <div
              className="space-y-3"
              role="status"
              aria-live="polite"
              aria-busy="true"
            >
              <div className="loading loading-spinner loading-lg mx-auto"></div>
            </div>
          ),
          title: "Signing you in...",
          description: "Processing your authentication",
        };
      case "syncing":
        return {
          icon: (
            <div
              className="space-y-3"
              role="status"
              aria-live="polite"
              aria-busy="true"
            >
              <div className="loading loading-spinner loading-lg mx-auto text-blue-500"></div>
            </div>
          ),
          title: "Syncing your data...",
          description: `Uploading ${initialGuestWorkoutCountRef.current ?? 0} workout${initialGuestWorkoutCountRef.current === 1 ? "" : "s"} to your account`,
        };
      case "complete":
        return {
          icon: <CheckCircle className="mx-auto h-12 w-12 text-primary" />,
          title: "Welcome back!",
          description: initialGuestWorkoutCountRef.current && initialGuestWorkoutCountRef.current > 0
            ? "Your data has been synced successfully"
            : "Successfully signed in",
        };
      case "error":
        return {
          icon: <AlertTriangle className="text-destructive mx-auto h-12 w-12" />,
          title: "Authentication failed",
          description: errorMessage,
        };
      default:
        return {
          icon: <div className="loading loading-spinner loading-lg"></div>,
          title: "Loading...",
          description: "",
        };
    }
  };

  const statusContent = getStatusContent();

  return (
    <div className="bg-background flex min-h-screen flex-col">
      <div className="p-4">
        <HomeLogo />
      </div>
      <div className="flex flex-1 items-center justify-center">
        <div className="mx-auto w-full max-w-3xl p-8 text-center">
          {statusContent.icon}
          <h1 className="sr-only">Post Login</h1>
          <h2 className="text-foreground mt-4 text-xl font-semibold">
            {statusContent.title}
          </h2>
          {statusContent.description && (
            <p className="text-muted-foreground mt-2">
              {statusContent.description}
            </p>
          )}
          {syncStatus === "error" && (
            <p className="text-muted-foreground mt-2 text-sm">
              Redirecting to login...
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default PostLoginPage;
