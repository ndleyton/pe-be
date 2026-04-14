import { useState } from "react";
import { Info, X } from "lucide-react";
import { useAuthStore, useGuestStore } from "@/stores";
const GuestModeBanner = () => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const workouts = useGuestStore((state) => state.workouts);

  const safeWorkouts = Array.isArray(workouts) ? workouts : [];

  const [isDismissed, setIsDismissed] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }

    return sessionStorage.getItem("guest-mode-banner-dismissed") === "true";
  });

  const handleDismiss = () => {
    setIsDismissed(true);
    sessionStorage.setItem("guest-mode-banner-dismissed", "true");
  };

  // Render immediately for guest sessions so page content doesn't shift after auth resolves.
  if (isAuthenticated || isDismissed) {
    return null;
  }

  return (
    <div
      data-testid="guest-mode-banner"
      className="sticky top-16 z-40 px-4 pt-3 transition-all duration-500 ease-in-out"
    >
      <div className="mx-auto w-full max-w-[400px]">
        <div className="pointer-events-auto group relative overflow-hidden rounded-2xl border border-border/60 bg-background/90 px-4 py-3.5 shadow-2xl shadow-black/30 backdrop-blur-xl transition-all duration-300 hover:border-primary/40">
          <div className="absolute inset-x-6 top-0 h-px bg-linear-to-r from-transparent via-primary/30 to-transparent opacity-70" />

          <button
            onClick={handleDismiss}
            className="absolute top-2 right-2 p-1 text-muted-foreground/50 transition-colors hover:text-foreground"
            aria-label="Dismiss banner"
          >
            <X className="h-3.5 w-3.5" />
          </button>

          <div className="relative flex items-center gap-3 pr-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary transition-transform duration-300 group-hover:scale-110">
              <Info className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1 space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary/80">
                  Guest Mode
                </span>
                {safeWorkouts.length > 0 && (
                  <span className="rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                    {safeWorkouts.length} Workout{safeWorkouts.length !== 1 ? "s" : ""}
                  </span>
                )}
              </div>
              <p className="text-muted-foreground text-[11px] font-medium leading-tight">
                Progress saved locally.
                <span className="text-foreground/90 font-semibold"> Sign in for AI & more.</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GuestModeBanner;
