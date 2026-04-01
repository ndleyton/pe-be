import { useEffect, useState } from "react";
import { useAuthStore, useGuestStore } from "@/stores";

// Delay in milliseconds before showing the banner to avoid layout shift
const BANNER_DISPLAY_DELAY_MS = 800;

const GuestModeBanner = () => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const authLoading = useAuthStore((state) => state.loading);
  const workouts = useGuestStore((state) => state.workouts);

  // Ensure workouts is always an array
  const safeWorkouts = Array.isArray(workouts) ? workouts : [];

  // Delay showing banner to avoid layout shift
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      // Show banner after a short delay for smoother transition
      const timer = setTimeout(() => {
        setShowBanner(true);
      }, BANNER_DISPLAY_DELAY_MS);
      return () => clearTimeout(timer);
    } else {
      setShowBanner(false);
    }
  }, [authLoading, isAuthenticated]);

  // Don't show banner if user is authenticated or still loading auth
  if (isAuthenticated || authLoading || !showBanner) {
    return null;
  }

  return (
    <div className="pointer-events-none">
      <div className="fixed top-16 right-0 left-0 z-40 px-4 lg:left-64">
        <div className="bg-accent/80 border-primary pointer-events-auto rounded-md border-l-4 p-4 shadow-lg backdrop-blur-md">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg
                className="text-primary h-5 w-5"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-accent-foreground text-sm">
                <strong>Guest Mode:</strong> Your workout data is stored locally
                on this device.
                {safeWorkouts.length > 0 && (
                  <span className="ml-1">
                    You have {safeWorkouts.length} workout
                    {safeWorkouts.length !== 1 ? "s" : ""} saved.
                  </span>
                )}{" "}
                <span className="font-medium">
                  Sign in with Google to sync your data across all devices and
                  save it permanently.
                </span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GuestModeBanner;
