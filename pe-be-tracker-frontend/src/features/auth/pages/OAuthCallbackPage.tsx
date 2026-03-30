import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { HomeLogo } from "@/shared/components/layout";
import { useGuestStore } from "@/stores";
import { useShallow } from "zustand/react/shallow";
import {
  syncGuestDataToServer,
  showSyncSuccessToast,
  showSyncErrorToast,
} from "@/utils/syncGuestData";
import api from "@/shared/api/client";
import { NAV_PATHS } from "@/shared/navigation/constants";

const OAuthCallbackPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { workouts: rawWorkouts, clear } = useGuestStore(
    useShallow((state) => ({
      workouts: state.workouts,
      clear: state.clear,
    })),
  );

  // Ensure workouts is always an array
  const workouts = Array.isArray(rawWorkouts) ? rawWorkouts : [];
  const [syncStatus, setSyncStatus] = useState<
    "processing" | "syncing" | "complete" | "error"
  >("processing");
  const [errorMessage, setErrorMessage] = useState<string>("");

  useEffect(() => {
    const handleOAuthCallback = async () => {
      try {
        setSyncStatus("processing");

        // Extract authorization code from URL parameters
        const code = searchParams.get("code");
        const error = searchParams.get("error");

        if (error) {
          throw new Error(`OAuth error: ${error}`);
        }

        if (!code) {
          throw new Error("No authorization code received");
        }

        // Exchange code for token
        await api.post("/auth/google/callback", {
          code: code,
        });

        // The backend's CookieTransportWithRedirect will set the cookie automatically.

        // Check if there's guest data to sync
        if (workouts.length > 0) {
          setSyncStatus("syncing");

          const syncResult = await syncGuestDataToServer(
            {
              workouts,
              exerciseTypes: useGuestStore.getState().exerciseTypes,
              workoutTypes: useGuestStore.getState().workoutTypes,
            },
            clear,
          );

          if (syncResult.success) {
            showSyncSuccessToast(syncResult);
            setSyncStatus("complete");
          } else {
            throw new Error(syncResult.error || "Failed to sync guest data");
          }
        } else {
          setSyncStatus("complete");
        }

        // Wait a moment to show success state, then redirect
        setTimeout(() => {
          navigate(NAV_PATHS.WORKOUTS, { replace: true });
        }, 2000);
      } catch (error) {
        console.error("OAuth callback error:", error);
        const errorMsg =
          error instanceof Error ? error.message : "Authentication failed";
        setErrorMessage(errorMsg);
        setSyncStatus("error");
        showSyncErrorToast(errorMsg);

        // Redirect back to login after error
        setTimeout(() => {
          navigate("/", { replace: true });
        }, 3000);
      }
    };

    handleOAuthCallback();
  }, [navigate, searchParams, workouts, clear]);

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
          description: `Uploading ${workouts.length} workout${workouts.length !== 1 ? "s" : ""} to your account`,
        };
      case "complete":
        return {
          icon: <div className="text-4xl text-green-500">✓</div>,
          title: "Welcome back!",
          description: "Your data has been synced successfully",
        };
      case "error":
        return {
          icon: <div className="text-destructive text-4xl">⚠</div>,
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
          <h1 className="sr-only">OAuth Callback</h1>
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

export default OAuthCallbackPage;
