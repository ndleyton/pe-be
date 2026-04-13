import { useEffect, useState } from "react";
import { Info } from "lucide-react";
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
    <div className="pointer-events-none fixed top-16 right-0 left-0 z-40 px-4 py-2.5 lg:left-64">
      <div className="pointer-events-auto group relative overflow-hidden rounded-xl border border-border/60 bg-background/82 px-3.5 py-3 shadow-lg shadow-black/5 backdrop-blur-md transition-colors duration-300 hover:border-primary/20 lg:px-4">
        <div className="absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-primary/25 to-transparent opacity-70" />

        <div className="relative flex items-start gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-primary/15 bg-primary/8 text-primary/75">
            <Info className="h-4 w-4" />
          </div>
          <div className="min-w-0 space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary/70">
                Guest Mode
              </span>
              {safeWorkouts.length > 0 && (
                <span className="rounded-full border border-primary/15 bg-primary/8 px-1.5 py-0.5 text-[10px] font-medium text-primary/75">
                  {safeWorkouts.length} Workout{safeWorkouts.length !== 1 ? "s" : ""}
                </span>
              )}
            </div>
            <p className="text-muted-foreground text-xs leading-relaxed">
              Your progress is saved on this device.
              <span className="text-foreground/75"> Sign in to access AI features and more exercises.</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GuestModeBanner;
