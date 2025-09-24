import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getIntensityUnits, IntensityUnit } from '@/features/exercises/api';
import { useGuestStore, useAuthStore } from '@/stores';
import { 
  Button,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger
} from '@/shared/components/ui';
import { Trash2 } from 'lucide-react';

// Guest intensity unit type (simplified)
interface GuestIntensityUnit {
  id: number;
  name: string;
  abbreviation: string;
}

interface ExerciseTypeMoreProps {
  currentIntensityUnit?: IntensityUnit | GuestIntensityUnit;
  onIntensityUnitChange: (unit: IntensityUnit | GuestIntensityUnit) => void;
  onExerciseDelete: () => void;
  onClose?: () => void;
}

const ExerciseTypeMore: React.FC<ExerciseTypeMoreProps> = ({ 
  currentIntensityUnit, 
  onIntensityUnitChange,
  onExerciseDelete,
  onClose
}) => {
  // Get state from stores
  const isAuthenticated = useAuthStore(state => state.isAuthenticated); 
  const { data: serverIntensityUnits = [], isLoading, error } = useQuery({
    queryKey: ['intensityUnits'],
    queryFn: getIntensityUnits,
    enabled: isAuthenticated, // Only fetch when authenticated
  });

  // For guest mode, use hardcoded intensity units (match backend)
  const guestIntensityUnits: GuestIntensityUnit[] = [
    { id: 1, name: 'Kilograms', abbreviation: 'kg' },
    { id: 2, name: 'Pounds', abbreviation: 'lbs' },
    { id: 5, name: 'Bodyweight', abbreviation: 'BW' },
  ];

  const intensityUnits = isAuthenticated ? serverIntensityUnits : guestIntensityUnits;

  return (
    <div className="p-4 space-y-4">

      {/* Intensity Unit Selection */}
      <div>
        <h4 className="text-sm font-medium text-foreground mb-3">Intensity Unit</h4>
        
        {isAuthenticated && isLoading && (
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 4 }).map((_, idx) => (
              <div key={idx} className="h-10 bg-muted rounded-lg animate-pulse" />
            ))}
          </div>
        )}

        {isAuthenticated && error && (
          <p className="text-center text-destructive text-sm">Failed to load intensity units.</p>
        )}

        {((!isAuthenticated) || (!isLoading && !error)) && (
          <div className="grid grid-cols-2 gap-2">
            {intensityUnits.map((unit) => (
              <button
                key={unit.id}
                onClick={() => onIntensityUnitChange(unit)}
                className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
                  currentIntensityUnit?.id === unit.id
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted hover:bg-accent text-muted-foreground'
                }`}
                aria-label={`Select ${unit.name} (${unit.abbreviation})`}
              >
                <span className="font-medium">{unit.abbreviation}</span>
                <span className="text-xs block opacity-75">{unit.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Delete Exercise Section */}
      <div className="border-t pt-4">
        <div className="flex justify-between items-center">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete Exercise
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Exercise</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete this exercise? This will also delete all associated sets and cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={onExerciseDelete}
                >
                  Delete Exercise
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          {onClose && (
            <Button
              onClick={onClose}
            >
              Close
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ExerciseTypeMore;