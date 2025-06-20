import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { getIntensityUnits, IntensityUnit } from '../../../../api/exercises';
import { useGuestData } from '../../../../contexts/GuestDataContext';

// Guest intensity unit type (simplified)
interface GuestIntensityUnit {
  id: number;
  name: string;
  abbreviation: string;
}

interface IntensityUnitModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (unit: IntensityUnit | GuestIntensityUnit) => void;
}

const IntensityUnitModal: React.FC<IntensityUnitModalProps> = ({ isOpen, onClose, onSelect }) => {
  const { isAuthenticated } = useGuestData();
  const { data: serverIntensityUnits = [], isLoading, error } = useQuery({
    queryKey: ['intensityUnits'],
    queryFn: getIntensityUnits,
    enabled: isAuthenticated(), // Only fetch when authenticated
  });

  // For guest mode, use hardcoded intensity units
  const guestIntensityUnits: GuestIntensityUnit[] = [
    { id: 1, name: 'Bodyweight', abbreviation: 'bw' },
    { id: 2, name: 'Kilograms', abbreviation: 'kg' },
    { id: 3, name: 'Pounds', abbreviation: 'lbs' },
  ];

  const intensityUnits = isAuthenticated() ? serverIntensityUnits : guestIntensityUnits;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
      onClick={handleBackdropClick}
      data-testid="intensity-unit-modal"
    >
      <div className="bg-gray-900 rounded-lg p-6 max-w-md w-full max-h-96 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-white">Select Unit:</h3>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {isAuthenticated() && isLoading && (
            <div className="grid grid-cols-2 gap-3">
              {Array.from({ length: 4 }).map((_, idx) => (
                <div key={idx} className="h-10 bg-gray-800 rounded-lg animate-pulse" />
              ))}
            </div>
          )}

          {isAuthenticated() && error && (
            <p className="text-center text-red-400">Failed to load intensity units.</p>
          )}

          {((!isAuthenticated()) || (!isLoading && !error)) && (
            <div className="grid grid-cols-2 gap-2">
              {intensityUnits.map((unit) => (
                <button
                  key={unit.id}
                  onClick={() => onSelect(unit)}
                  className="w-full text-left px-4 py-2 rounded bg-gray-800 hover:bg-gray-700 text-gray-200"
                  aria-label={`Select ${unit.name} (${unit.abbreviation})`}
                >
                  {unit.abbreviation} - {unit.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default IntensityUnitModal; 