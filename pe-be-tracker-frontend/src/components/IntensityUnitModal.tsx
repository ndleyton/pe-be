import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { getIntensityUnits, IntensityUnit } from '../api/exercises';

interface IntensityUnitModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (unit: IntensityUnit) => void;
}

const IntensityUnitModal: React.FC<IntensityUnitModalProps> = ({ isOpen, onClose, onSelect }) => {
  const { data: intensityUnits = [], isLoading, error } = useQuery({
    queryKey: ['intensityUnits'],
    queryFn: getIntensityUnits,
  });

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
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-white">Select Unit:</h3>
          <button
            onClick={onClose}
            aria-label="Close modal"
            className="text-gray-400 hover:text-white"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {isLoading && (
            <div className="grid grid-cols-2 gap-3">
              {Array.from({ length: 4 }).map((_, idx) => (
                <div key={idx} className="h-10 bg-gray-800 rounded-lg animate-pulse" />
              ))}
            </div>
          )}

          {error && (
            <p className="text-center text-red-400">Failed to load intensity units.</p>
          )}

          {!isLoading && !error && (
            <>
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
              <button
                type="button"
                onClick={onClose}
                className="mt-4 w-full px-4 py-2 text-sm text-gray-400 hover:text-white"
                aria-label="Cancel unit selection"
              >
                Cancel
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default IntensityUnitModal; 