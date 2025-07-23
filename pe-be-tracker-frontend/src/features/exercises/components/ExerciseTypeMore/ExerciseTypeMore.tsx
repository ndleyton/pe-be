import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { getIntensityUnits, IntensityUnit } from '@/features/exercises/api';
import { useGuestStore, useAuthStore } from '@/stores';

// Guest intensity unit type (simplified)
interface GuestIntensityUnit {
  id: number;
  name: string;
  abbreviation: string;
}

interface ExerciseTypeMoreProps {
  currentIntensityUnit?: IntensityUnit | GuestIntensityUnit;
  onIntensityUnitChange: (unit: IntensityUnit | GuestIntensityUnit) => void;
}

const ExerciseTypeMore: React.FC<ExerciseTypeMoreProps> = ({ 
  currentIntensityUnit, 
  onIntensityUnitChange 
}) => {
  // Get state from stores
  const isAuthenticated = useAuthStore(state => state.isAuthenticated); 
  const { data: serverIntensityUnits = [], isLoading, error } = useQuery({
    queryKey: ['intensityUnits'],
    queryFn: getIntensityUnits,
    enabled: isAuthenticated, // Only fetch when authenticated
  });

  // For guest mode, use hardcoded intensity units
  const guestIntensityUnits: GuestIntensityUnit[] = [
    { id: 1, name: 'Bodyweight', abbreviation: 'bw' },
    { id: 2, name: 'Kilograms', abbreviation: 'kg' },
    { id: 3, name: 'Pounds', abbreviation: 'lbs' },
  ];

  const intensityUnits = isAuthenticated ? serverIntensityUnits : guestIntensityUnits;

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div>
        <h3 className="text-lg font-semibold text-foreground mb-2">Exercise Settings</h3>
      </div>

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
    </div>
  );
};

export default ExerciseTypeMore;