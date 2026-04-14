import { Info } from "lucide-react";
import { useAuthStore, useGuestStore } from "@/stores";



const GuestModeBanner = () => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const authLoading = useAuthStore((state) => state.loading);
  const workouts = useGuestStore((state) => state.workouts);

  const safeWorkouts = Array.isArray(workouts) ? workouts : [];

  // Don't show banner if user is authenticated or still loading auth
  if (isAuthenticated || authLoading) {
    return null;
  }

  return (
    <div
      className="fixed z-50 px-4 transition-all duration-300 md:px-0"
      style={{
        bottom: "calc(env(safe-area-inset-bottom) + 5rem)",
        left: "1rem",
        right: "1rem",
        maxWidth: "min(600px, 100vw - 2rem)",
        margin: "0 auto",
      }}
    >
      <div className="group relative overflow-hidden rounded-2xl border border-border/60 bg-background/80 px-4 py-3.5 shadow-2xl shadow-black/20 backdrop-blur-xl hover:border-primary/30">
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
            <p className="text-muted-foreground text-[11px] leading-tight font-medium">
              Progress saved on this device.
              <span className="text-foreground/80"> Sign in for AI & more.</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GuestModeBanner;
