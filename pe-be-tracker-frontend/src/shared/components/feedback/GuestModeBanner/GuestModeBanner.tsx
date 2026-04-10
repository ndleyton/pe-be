import { Button } from "@/shared/components/ui/button";

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
    <div className="pointer-events-none fixed top-16 right-0 left-0 z-40 px-4 py-3 lg:left-64">
      <div className="pointer-events-auto group relative overflow-hidden rounded-2xl border border-primary/20 bg-card/40 p-4 shadow-2xl backdrop-blur-xl transition-all duration-500 hover:border-primary/40 active:scale-[0.99] lg:p-5">
        {/* Animated background glow */}
        <div className="absolute -inset-24 bg-gradient-to-tr from-primary/10 via-transparent to-primary/5 opacity-40 blur-3xl group-hover:opacity-60 transition-opacity duration-1000" />
        
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3 flex-1">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 border border-primary/20 shadow-inner group-hover:scale-110 transition-transform duration-500">
              <Info className="h-5 w-5 text-primary" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/80">
                  Guest Mode
                </span>
                {safeWorkouts.length > 0 && (
                  <span className="rounded-full bg-primary/20 px-2 py-0.5 text-[10px] font-bold text-primary">
                    {safeWorkouts.length} Workout{safeWorkouts.length !== 1 ? "s" : ""}
                  </span>
                )}
              </div>
              <p className="text-foreground/90 text-sm leading-relaxed font-medium max-w-2xl">
                Your progress is local. <span className="text-muted-foreground font-normal">Sign in to sync your data and unlock the full potential of your Personal Bestie.</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GuestModeBanner;
