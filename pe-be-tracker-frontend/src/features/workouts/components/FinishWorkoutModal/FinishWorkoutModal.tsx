import { useEffect, useRef, useState, type MouseEvent } from "react";
import {
  calculateMuscleGroupSummary,
  ExerciseTypeWithMuscles,
} from "@/utils/muscleGroups";
import { Button } from "@/shared/components/ui/button";
import AnatomicalImage from "./AnatomicalImage";
import { toPng } from "html-to-image";
import { Download, RefreshCw, Sparkles, Timer, CircleAlert } from "lucide-react";
import { useUIStore } from "@/stores";

const LAYOUT_STABILIZATION_DELAY_MS = 50;
const DEFAULT_DEVICE_PIXEL_RATIO_FALLBACK = 1;
const MIN_EXPORT_PIXEL_RATIO = 2;
const DEFAULT_EXPORT_BACKGROUND = "#ffffff";
const DATE_LABEL_LOCALE = "en-US";
const DATE_LABEL_OPTIONS: Intl.DateTimeFormatOptions = {
  month: "short",
  day: "2-digit",
};

interface Exercise {
  exercise_type: ExerciseTypeWithMuscles | { name: string };
  exercise_sets: Array<{ done?: boolean }>;
}

interface FinishWorkoutModalProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
  isAuthenticated?: boolean;
  exercises?: Exercise[];
  onSaveRoutine?: () => void;
  workoutName?: string;
  recap?: string | null;
  isRecapLoading?: boolean;
  onRegenerateRecap?: () => void;
}

const FinishWorkoutModal = ({
  isOpen,
  onConfirm,
  onCancel,
  isLoading = false,
  isAuthenticated = false,
  exercises = [],
  onSaveRoutine,
  workoutName,
  recap,
  isRecapLoading = false,
  onRegenerateRecap,
}: FinishWorkoutModalProps) => {
  const downloadAreaRef = useRef<HTMLDivElement>(null);
  const formattedDuration = useUIStore((state) =>
    state.getFormattedWorkoutTime(),
  );
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null);

  // Preload logo as data URL to avoid CORS/taint issues in html2canvas
  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const res = await fetch("/assets/logo.svg", { cache: "force-cache" });
        if (!res.ok) {
          throw new Error(`Failed to fetch logo.svg (status ${res.status})`);
        }
        const svg = await res.text();
        if (!isMounted) return;
        const dataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
        setLogoDataUrl(dataUrl);
      } catch (error) {
        console.error("Error preloading logo SVG:", error);
        setLogoDataUrl(null);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  if (!isOpen) return null;

  const muscleGroupSummary = calculateMuscleGroupSummary(exercises);
  const totalSets = muscleGroupSummary.reduce(
    (sum, group) => sum + group.setCount,
    0,
  );

  const handleDownload = async () => {
    const node = downloadAreaRef.current;
    if (!node) return;
    try {
      // Ensure layout and any async assets are fully ready
      await new Promise(requestAnimationFrame);
      await new Promise(requestAnimationFrame);
      await new Promise((resolve) =>
        setTimeout(resolve, LAYOUT_STABILIZATION_DELAY_MS),
      );

      const rect = node.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) {
        throw new Error("Share area has zero size");
      }

      // Ensure fonts are loaded to prevent baseline/centering shifts
      if ("fonts" in document && (document as any).fonts?.ready) {
        await (document as any).fonts.ready;
      }

      // Resolve background to match Tailwind's bg-background (theme-aware)
      let resolvedBackground: string | undefined;
      try {
        const nodeBg = window.getComputedStyle(node).backgroundColor;
        if (
          nodeBg &&
          nodeBg !== "rgba(0, 0, 0, 0)" &&
          nodeBg !== "transparent"
        ) {
          resolvedBackground = nodeBg;
        } else {
          const rootStyles = window.getComputedStyle(document.documentElement);
          const varBg = rootStyles.getPropertyValue("--background").trim();
          if (varBg) {
            resolvedBackground = varBg;
          }
        }
      } catch (error) {
        console.warn(
          "Could not resolve computed background color; defaulting to white.",
          error,
        );
      }

      const image = await toPng(node, {
        backgroundColor: resolvedBackground || DEFAULT_EXPORT_BACKGROUND,
        cacheBust: true,
        filter: (domNode) =>
          !(domNode instanceof Element) ||
          domNode.getAttribute("data-export-ignore") !== "true",
        pixelRatio: Math.max(
          window.devicePixelRatio || DEFAULT_DEVICE_PIXEL_RATIO_FALLBACK,
          MIN_EXPORT_PIXEL_RATIO,
        ),
      });

      // Build filename: "Workout Summary {Mon DD}.png"
      const now = new Date();
      const label = new Intl.DateTimeFormat(
        DATE_LABEL_LOCALE,
        DATE_LABEL_OPTIONS,
      ).format(now);
      const filename = `Workout Summary ${label}.png`;

      const link = document.createElement("a");
      link.href = image;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error("Error downloading workout summary:", error);
      alert("Failed to download workout summary.");
    }
  };

  const handleBackdropClick = (e: MouseEvent) => {
    if (e.target === e.currentTarget) {
      onCancel();
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div
        className="text-card-foreground mx-4 flex max-h-[90vh] w-full max-w-md flex-col"
        data-testid="finish-workout-modal"
      >
        <div className="bg-card flex-1 overflow-y-auto rounded-lg p-6 flex flex-col min-h-[300px]">
          {totalSets === 0 && (
            <div className="flex-1 flex flex-col items-center justify-center text-center space-y-6 animate-in fade-in zoom-in duration-300">
              <div className="relative">
                <div className="absolute -inset-4 bg-primary/20 blur-2xl rounded-full" />
                <div className="relative bg-primary/10 p-5 rounded-3xl border border-primary/20 shadow-xl">
                  <CircleAlert className="h-12 w-12 text-primary drop-shadow-sm" />
                </div>
              </div>
              <div className="space-y-2 max-w-[260px]">
                <h3 className="text-foreground text-lg font-black tracking-tight leading-tight">
                  No Sets Done Yet!
                </h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  You have not completed any sets, mark some sets as done and come back to finish your workout
                </p>
              </div>
            </div>
          )}
          {muscleGroupSummary.length > 0 && (
            <div
              ref={downloadAreaRef}
              className="bg-background mb-4 rounded-lg p-3"
            >
              {/* Header: Logo and Duration for shareable image */}
              <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2 rounded-full bg-primary/5 px-2.5 py-1 border border-primary/10 shadow-sm">
                    <img
                      src={logoDataUrl ?? "/assets/logo.svg"}
                      alt="Personal Bestie Logo"
                      className="h-7 w-7"
                      crossOrigin="anonymous"
                    />
                    <div className="flex flex-col items-start drop-shadow-sm text-left text-[13px] leading-[0.85] font-black tracking-tight text-primary pr-1">
                      <span>Personal</span>
                      <span>Bestie.com</span>
                    </div>
                  </div>
                <div className="flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 border border-primary/20 text-primary text-xs font-black tracking-wide shadow-sm">
                  <Timer className="h-3.5 w-3.5" />
                  {formattedDuration}
                </div>
              </div>
              <div className="mb-2 grid grid-cols-[2.25rem_minmax(0,1fr)_2.25rem] items-center gap-2">
                <div aria-hidden="true" className="size-9" />
                <h3 className="text-foreground break-words text-center text-2xl leading-tight font-black tracking-tight">
                  <span className="bg-gradient-to-b from-foreground to-foreground/70 bg-clip-text text-transparent">
                    {workoutName ?? "Great Training Session!"}
                  </span>
                </h3>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={handleDownload}
                  data-export-ignore="true"
                  aria-label="Download workout summary image"
                  title="Download image"
                  className="text-primary hover:text-primary rounded-full bg-background/90 shadow-sm backdrop-blur-sm hover:bg-primary/10"
                >
                  <Download className="h-4 w-4" />
                </Button>
              </div>
              <AnatomicalImage muscleGroupSummary={muscleGroupSummary} />
              <div className="grid gap-2">
                {muscleGroupSummary.map((group) => (
                  <div
                    key={group.name}
                    className="group flex items-center justify-between rounded-2xl border border-border/40 bg-muted/20 px-4 py-3 transition-all hover:bg-muted/30 hover:border-border/60"
                  >
                    <span className="text-sm font-black uppercase tracking-widest opacity-70">
                      {group.name}
                    </span>
                    <span className="text-primary text-sm font-black">
                      {group.setCount} set{group.setCount !== 1 ? "s" : ""}
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-3 border-t border-dashed border-border/60 pt-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase tracking-[0.2em] opacity-40">
                    Total Sets Completed
                  </span>
                  <span className="text-primary text-xl font-black drop-shadow-sm">
                    {totalSets}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* AI Recap Section */}
          {totalSets > 0 && (
            <div className="relative group overflow-hidden rounded-2xl border border-primary/20 bg-card/50 p-5 shadow-xl backdrop-blur-md transition-all duration-500 hover:border-primary/40 mb-4">
              {/* Subtle background glow */}
              <div className="absolute -inset-1 bg-gradient-to-r from-primary/20 via-primary/5 to-primary/20 opacity-30 blur-2xl group-hover:opacity-50 transition-opacity duration-1000 animate-pulse" />

              <div className="relative">
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="bg-primary/10 flex h-8 w-8 items-center justify-center rounded-lg">
                      <Sparkles className="h-4 w-4 text-primary animate-pulse" />
                    </div>
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-primary/80">
                      Personal Bestie:
                    </h4>
                  </div>
                  {onRegenerateRecap && !isRecapLoading && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onRegenerateRecap();
                      }}
                      className="text-muted-foreground hover:text-primary transition-colors focus:ring-primary/20 rounded-full p-1.5 hover:bg-primary/5 transition-transform active:rotate-180"
                      title="Regenerate recap"
                      aria-label="Regenerate AI recap"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                {isRecapLoading ? (
                  <div className="space-y-3 py-1">
                    <div className="h-3 w-full animate-pulse rounded-full bg-primary/10" />
                    <div className="h-3 w-[90%] animate-pulse rounded-full bg-primary/5" />
                    <div className="h-3 w-[75%] animate-pulse rounded-full bg-primary/10" />
                  </div>
                ) : recap ? (
                  <p className="text-foreground/90 text-[13px] leading-relaxed italic font-medium">
                    &ldquo;{recap}&rdquo;
                  </p>
                ) : !isAuthenticated ? (
                  <p className="text-muted-foreground text-[11px] italic opacity-70">
                    AI recaps are available for logged-in users.
                  </p>
                ) : (
                  <p className="text-muted-foreground text-[11px] italic opacity-70">
                    Recap generation skipped or failed.
                  </p>
                )}
              </div>
            </div>
          )}

          {onSaveRoutine && exercises.length > 0 && (
            <div className="bg-accent/10 border-accent/20 mb-4 rounded-lg border p-3">
              <div className="mb-2 flex items-center space-x-2">
                <span className="text-sm font-medium">📋 Save as Routine</span>
              </div>
              <p className="text-muted-foreground mb-3 text-sm">
                Save this workout as a reusable routine for quick starts in the
                future.
              </p>
              <Button
                onClick={onSaveRoutine}
                variant="outline"
                size="sm"
                className="w-full"
              >
                Save Routine
              </Button>
            </div>
          )}
        </div>
        {/* Footer */}
        <div className="flex shrink-0 justify-end gap-3 px-6 py-5">
          <Button
            onClick={onCancel}
            disabled={isLoading}
            variant="glass"
            className="rounded-xl px-6"
          >
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            disabled={isLoading}
            className="bg-primary/90 hover:bg-primary rounded-xl px-8 font-bold shadow-lg shadow-primary/20 backdrop-blur-md transition-all active:scale-95"
          >
            {isLoading ? "Finishing..." : "Finish Workout"}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default FinishWorkoutModal;
