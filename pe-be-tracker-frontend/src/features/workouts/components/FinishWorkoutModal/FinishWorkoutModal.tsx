import React, { useRef } from 'react';
import { calculateMuscleGroupSummary, MuscleGroupSummary, ExerciseTypeWithMuscles } from '@/utils/muscleGroups';
import { Button } from '@/components/ui/button';
import AnatomicalImage from './AnatomicalImage';
import SocialShareButton from './SocialShareButton';
import html2canvas from 'html2canvas';

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

  if (!isOpen) return null;

  // Calculate muscle group summary
  const muscleGroupSummary = calculateMuscleGroupSummary(exercises);
  const totalSets = muscleGroupSummary.reduce((sum, group) => sum + group.setCount, 0);

  const handleShare = async () => {
    if (shareContentRef.current) {
      try {
        const canvas = await html2canvas(shareContentRef.current, {
          useCORS: true, // Important for handling images loaded from different origins
          allowTaint: true, // Allow tainting the canvas
          backgroundColor: null, // Transparent background
        });
        const image = canvas.toDataURL('image/png');

        if (navigator.share) {
          await navigator.share({
            title: workoutName ? `My workout: ${workoutName}` : 'My Workout Summary',
            text: `Check out my workout summary! I completed ${totalSets} sets.`, 
            files: [await (await fetch(image)).blob()],
          });
        } else {
          // Fallback for browsers that do not support Web Share API
          const link = document.createElement('a');
          link.href = image;
          link.download = 'workout-summary.png';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          alert('Image downloaded! You can share it manually.');
        }
      } catch (error) {
        console.error('Error sharing workout summary:', error);
        alert('Failed to share workout summary.');
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-card text-card-foreground p-6 rounded-lg max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto" data-testid="finish-workout-modal">
        <h2 className="text-xl font-bold mb-4">Finish Workout?</h2>
        <p className="mb-4 text-muted-foreground">
          Are you sure you want to finish this workout? This will set the end time to now.
        </p>

        {/* Muscle Group Summary */}
        {muscleGroupSummary.length > 0 && (
          <div className="mb-6 p-4 bg-background rounded-lg" ref={shareContentRef}>
            <h3 className="text-lg font-semibold mb-3 text-primary">
              🎉 Great work! You trained:
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

        {/* Social Share Button */}
        {muscleGroupSummary.length > 0 && (
          <div className="mb-4">
            <SocialShareButton onShare={handleShare} />
          </div>
        )}

        {/* Save Recipe Option */}
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

        {/* Action Buttons */}
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