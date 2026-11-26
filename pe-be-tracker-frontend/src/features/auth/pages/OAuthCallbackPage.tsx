import { usePostLoginCompletion } from "@/features/auth/hooks";
import { HomeLogo } from "@/shared/components/layout";
import { CheckCircle, AlertTriangle, Loader2 } from "lucide-react";

const workouts = (count: number) =>
  `${count} workout${count === 1 ? "" : "s"}`;

const describeCompletion = (syncedCount: number, keptCount: number) => {
  if (keptCount === 0) {
    return syncedCount > 0
      ? "Your data has been synced successfully"
      : "Successfully signed in";
  }
  const kept = `${workouts(keptCount)} ${keptCount === 1 ? "is" : "are"} kept on this device.`;
  return syncedCount > 0 ? `Synced ${workouts(syncedCount)}. ${kept}` : kept;
};

const PostLoginPage = () => {
  const {
    errorMessage,
    initialGuestWorkoutCount,
    keptWorkoutCount,
    syncStatus,
    syncedWorkoutCount,
  } = usePostLoginCompletion();

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
              <Loader2 aria-hidden="true" className="h-10 w-10 animate-spin motion-reduce:animate-none mx-auto" />
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
              <Loader2 aria-hidden="true" className="h-10 w-10 animate-spin motion-reduce:animate-none mx-auto text-primary" />
            </div>
          ),
          title: "Syncing your data...",
          description: `Uploading ${initialGuestWorkoutCount} workout${initialGuestWorkoutCount === 1 ? "" : "s"} to your account`,
        };
      case "complete":
        return {
          icon: <CheckCircle className="mx-auto h-12 w-12 text-primary" />,
          title: "You're all set!",
          description: describeCompletion(syncedWorkoutCount, keptWorkoutCount),
        };
      case "error":
        return {
          icon: <AlertTriangle className="text-destructive mx-auto h-12 w-12" />,
          title: "Authentication failed",
          description: errorMessage,
        };
      default:
        return {
          icon: <Loader2 aria-hidden="true" className="h-10 w-10 animate-spin motion-reduce:animate-none" />,
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
