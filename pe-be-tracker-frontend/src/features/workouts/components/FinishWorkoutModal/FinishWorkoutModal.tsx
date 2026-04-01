import { useEffect, useRef, useState, type MouseEvent } from "react";
import {
  calculateMuscleGroupSummary,
  ExerciseTypeWithMuscles,
} from "@/utils/muscleGroups";
import { Button } from "@/shared/components/ui/button";
import AnatomicalImage from "./AnatomicalImage";
import DownloadImageButton from "./DownloadImageButton/DownloadImageButton";
import { toPng } from "html-to-image";
import { RefreshCw } from "lucide-react";
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
        <div className="bg-card flex-1 overflow-y-auto rounded-lg p-6">
          {muscleGroupSummary.length > 0 && (
            <div
              ref={downloadAreaRef}
              className="bg-background mb-6 rounded-lg p-4"
            >
              {/* Header: Logo and Duration for shareable image */}
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-1">
                  <img
                    src={logoDataUrl ?? "/assets/logo.svg"}
                    alt="Personal Bestie Logo"
                    className="h-8 w-8"
                    crossOrigin="anonymous"
                  />
                  <div className="text-primary flex flex-col items-start text-left text-base leading-none font-bold">
                    <span>Personal</span>
                    <span>Bestie.com</span>
                  </div>
                </div>
                <div className="text-foreground text-sm font-semibold">
                  Workout Duration:{" "}
                  <span className="text-primary">{formattedDuration}</span>
                </div>
              </div>
              <h3 className="text-primary mb-1 text-lg font-bold">
                {workoutName ?? "Great Training Session!"}
              </h3>
              <AnatomicalImage muscleGroupSummary={muscleGroupSummary} />
              <div className="space-y-2">
                {muscleGroupSummary.map((group) => (
                  <div
                    key={group.name}
                    className="bg-muted flex items-center justify-between rounded px-3 py-2"
                  >
                    <span className="font-medium">{group.name}</span>
                    <span className="text-primary font-bold">
                      {group.setCount} set{group.setCount !== 1 ? "s" : ""}
                    </span>
                  </div>
                ))}
              </div>
              <div className="border-border mt-3 border-t pt-3">
                <div className="flex items-center justify-between font-bold">
                  <span>Total Sets Completed:</span>
                  <span className="text-primary text-lg">{totalSets}</span>
                </div>
              </div>
            </div>
          )}

          {/* AI Recap Section */}
          {totalSets > 0 && (
            <div className="bg-card/80 border-border mb-4 rounded-lg border p-4 shadow-sm backdrop-blur-sm">
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-lg">✨</span>
                  <h4 className="text-sm font-bold uppercase tracking-wider">
                    AI Recap
                  </h4>
                </div>
                {onRegenerateRecap && !isRecapLoading && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRegenerateRecap();
                    }}
                    className="text-muted-foreground hover:text-primary transition-colors focus:ring-primary/20 rounded-full p-1 transition-transform active:rotate-180"
                    title="Regenerate recap"
                    aria-label="Regenerate AI recap"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              {isRecapLoading ? (
                <div className="space-y-2 py-1">
                  <div className="bg-muted h-3 w-full animate-pulse rounded" />
                  <div className="bg-muted h-3 w-4/5 animate-pulse rounded" />
                  <div className="bg-muted h-3 w-3/4 animate-pulse rounded" />
                </div>
              ) : recap ? (
                <p className="text-foreground text-sm leading-relaxed italic">
                  &ldquo;{recap}&rdquo;
                </p>
              ) : (
                <p className="text-muted-foreground text-xs italic">
                  Recap generation skipped or failed.
                </p>
              )}
            </div>
          )}

          {muscleGroupSummary.length > 0 && (
            <div className="mb-4">
              <DownloadImageButton onDownload={handleDownload} />
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
        <div className="flex shrink-0 justify-end gap-4 px-6 py-4">
          <Button
            onClick={onCancel}
            disabled={isLoading}
            variant="outline"
            className="bg-card/80 hover:bg-accent border-border backdrop-blur-sm"
          >
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            disabled={isLoading}
            className="bg-primary hover:bg-primary/90"
          >
            {isLoading ? "Finishing..." : "Finish Workout"}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default FinishWorkoutModal;
