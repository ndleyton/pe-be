import React, { useEffect, useRef, useState } from 'react';
import { calculateMuscleGroupSummary, MuscleGroupSummary, ExerciseTypeWithMuscles } from '@/utils/muscleGroups';
import { Button } from '@/shared/components/ui/button';
import AnatomicalImage from './AnatomicalImage';
import DownloadImageButton from './DownloadImageButton/DownloadImageButton';
import html2canvas from 'html2canvas';
import { useUIStore } from '@/stores';

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
  onSaveRecipe?: () => void;
  workoutName?: string;
}

const FinishWorkoutModal: React.FC<FinishWorkoutModalProps> = ({
  isOpen,
  onConfirm,
  onCancel,
  isLoading = false,
  exercises = [],
  onSaveRecipe,
  workoutName,
}) => {
  const shareContentRef = useRef<HTMLDivElement>(null);
  const downloadAreaRef = useRef<HTMLDivElement>(null);
  const formattedDuration = useUIStore(state => state.getFormattedWorkoutTime());
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null);

  // Preload logo as data URL to avoid CORS/taint issues in html2canvas
  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const res = await fetch('/assets/logo.svg', { cache: 'force-cache' });
        const svg = await res.text();
        if (!isMounted) return;
        const dataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
        setLogoDataUrl(dataUrl);
      } catch (_) {
        setLogoDataUrl(null);
      }
    })();
    return () => { isMounted = false; };
  }, []);

  if (!isOpen) return null;

  // Calculate muscle group summary
  const muscleGroupSummary = calculateMuscleGroupSummary(exercises);
  const totalSets = muscleGroupSummary.reduce((sum, group) => sum + group.setCount, 0);

  const handleDownload = async () => {
    const node = downloadAreaRef.current;
    if (!node) return;
    try {
      // Ensure layout and any async assets are fully ready
      await new Promise(requestAnimationFrame);
      await new Promise(requestAnimationFrame);
      await new Promise(resolve => setTimeout(resolve, 50));

      // NOTE: Avoid forcing foreignObject rendering or manual inlining, which can cause blank canvases

      const rect = node.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) {
        throw new Error('Share area has zero size');
      }

      const canvas = await html2canvas(node, {
        useCORS: true,
        backgroundColor: '#ffffff',
        scale: Math.max(window.devicePixelRatio || 1, 2),
        imageTimeout: 15000,
        logging: false,
      });
      const image = canvas.toDataURL('image/png');

      // Build filename: "Workout Summary {Mon DD}.png" using Intl for clarity
      const now = new Date();
      const label = new Intl.DateTimeFormat('en-US', { month: 'short', day: '2-digit' }).format(now);
      const filename = `Workout Summary ${label}.png`;

      const link = document.createElement('a');
      link.href = image;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Error downloading workout summary:', error);
      alert('Failed to download workout summary.');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-card text-card-foreground p-6 rounded-lg max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto" data-testid="finish-workout-modal">
        <h2 className="text-xl font-bold mb-4">Finish Workout?</h2>
        <p className="mb-4 text-muted-foreground">
          Are you sure you want to finish this workout?
        </p>

        {muscleGroupSummary.length > 0 && (
          <div ref={downloadAreaRef} className="mb-6 p-4 bg-background rounded-lg">
            {/* Header: Logo and Duration for shareable image */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-1">
                <img
                  src={logoDataUrl ?? '/assets/logo.svg'}
                  alt="Personal Bestie Logo"
                  className="w-8 h-8"
                  crossOrigin="anonymous"
                />
                <div className="flex flex-col leading-none items-start text-left text-base font-bold text-primary">
                  <span>Personal</span>
                  <span>Bestie.com</span>
                </div>
              </div>
              <div className="text-sm font-semibold text-foreground">
                Workout Duration: <span className="text-primary">{formattedDuration}</span>
              </div>
            </div>
            <h3 className="text-lg font-semibold mb-3 text-muted-foreground">
              {workoutName ?? 'Great Training Session!'}
            </h3>
            <AnatomicalImage muscleGroupSummary={muscleGroupSummary} />
            <div className="space-y-2">
              {muscleGroupSummary.map((group) => (
                <div
                  key={group.name}
                  className="flex justify-between items-center py-2 px-3 bg-muted rounded"
                >
                  <span className="font-medium">{group.name}</span>
                  <span className="text-primary font-bold">
                    {group.setCount} set{group.setCount !== 1 ? 's' : ''}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-3 pt-3 border-t border-border">
              <div className="flex justify-between items-center font-bold">
                <span>Total Sets Completed:</span>
                <span className="text-primary text-lg">{totalSets}</span>
              </div>
            </div>
          </div>
        )}

        {muscleGroupSummary.length > 0 && (
          <div className="mb-4">
            <DownloadImageButton onDownload={handleDownload} />
          </div>
        )}

        {onSaveRecipe && exercises.length > 0 && (
          <div className="mb-4 p-3 bg-accent/10 border border-accent/20 rounded-lg">
            <div className="flex items-center space-x-2 mb-2">
              <span className="text-sm font-medium">📋 Save as Recipe</span>
            </div>
            <p className="text-sm text-muted-foreground mb-3">
              Save this workout as a reusable recipe for quick starts in the future.
            </p>
            <Button
              onClick={onSaveRecipe}
              variant="outline"
              size="sm"
              className="w-full"
            >
              Save Recipe
            </Button>
          </div>
        )}

        <div className="flex justify-end space-x-4">
          <Button
            onClick={onCancel}
            disabled={isLoading}
            variant="outline"
            className="bg-muted hover:bg-accent border-border"
          >
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            disabled={isLoading}
            className="bg-primary hover:bg-primary/90"
          >
            {isLoading ? 'Finishing...' : 'Finish Workout'}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default FinishWorkoutModal;