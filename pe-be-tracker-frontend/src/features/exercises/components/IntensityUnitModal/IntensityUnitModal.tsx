import React from "react";
import { useQuery } from "@tanstack/react-query";
import { getIntensityUnits, IntensityUnit } from "@/features/exercises/api";
import { useGuestStore, useAuthStore } from "@/stores";

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

const IntensityUnitModal: React.FC<IntensityUnitModalProps> = ({
  isOpen,
  onClose,
  onSelect,
}) => {
  // Get state from stores
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const {
    data: serverIntensityUnits = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["intensityUnits"],
    queryFn: getIntensityUnits,
    enabled: isAuthenticated, // Only fetch when authenticated
  });

  // For guest mode, use hardcoded intensity units
  const guestIntensityUnits: GuestIntensityUnit[] = [
    { id: 1, name: "Bodyweight", abbreviation: "bw" },
    { id: 2, name: "Kilograms", abbreviation: "kg" },
    { id: 3, name: "Pounds", abbreviation: "lbs" },
  ];

  const intensityUnits = isAuthenticated
    ? serverIntensityUnits
    : guestIntensityUnits;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={handleBackdropClick}
      data-testid="intensity-unit-modal"
    >
      <div className="bg-background flex max-h-96 w-full max-w-md flex-col overflow-hidden rounded-lg p-6">
        {/* Header */}
        <div className="mb-4">
          <h3 className="text-foreground text-lg font-semibold">
            Select Unit:
          </h3>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {isAuthenticated && isLoading && (
            <div className="grid grid-cols-2 gap-3">
              {Array.from({ length: 4 }).map((_, idx) => (
                <div
                  key={idx}
                  className="bg-muted h-10 animate-pulse rounded-lg"
                />
              ))}
            </div>
          )}

          {isAuthenticated && error && (
            <p className="text-destructive text-center">
              Failed to load intensity units.
            </p>
          )}

          {(!isAuthenticated || (!isLoading && !error)) && (
            <div className="grid grid-cols-2 gap-2">
              {intensityUnits.map((unit) => (
                <button
                  key={unit.id}
                  onClick={() => onSelect(unit)}
                  className="bg-muted hover:bg-accent text-muted-foreground w-full rounded px-4 py-2 text-left"
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
