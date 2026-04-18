import { useQuery } from "@tanstack/react-query";

import { getIntensityUnits, IntensityUnit } from "@/features/exercises/api";
import { GUEST_INTENSITY_UNITS } from "@/features/exercises/constants";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui";

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

const UNIT_DESCRIPTIONS: Record<string, string> = {
  bw: "Your own body weight",
  kg: "Metric load",
  lb: "Imperial load",
  lbs: "Imperial load",
  "km/h": "Pace or speed work",
  mph: "Pace or speed work",
  reps: "Rep-based effort",
};

const getUnitDescription = (unit: IntensityUnit | GuestIntensityUnit) =>
  UNIT_DESCRIPTIONS[unit.abbreviation.toLowerCase()] ?? "Used to track effort";

const getDisplayAbbreviation = (abbreviation: string) =>
  abbreviation.toUpperCase();

const IntensityUnitOption = ({
  unit,
  onSelect,
}: {
  unit: IntensityUnit | GuestIntensityUnit;
  onSelect: (unit: IntensityUnit | GuestIntensityUnit) => void;
}) => (
  <button
    type="button"
    onClick={() => onSelect(unit)}
    className={cn(
      "group border-border/70 bg-card hover:border-primary/40 hover:bg-accent/40 focus-visible:ring-ring flex w-full items-start gap-3 rounded-2xl border px-4 py-3 text-left shadow-sm transition-all",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
    )}
    aria-label={`Select ${unit.name} (${getDisplayAbbreviation(unit.abbreviation)})`}
  >
    <div className="bg-muted text-foreground group-hover:bg-primary/10 flex min-h-11 min-w-11 items-center justify-center rounded-xl px-2.5">
      <span className="text-sm font-semibold uppercase tracking-tight">
        {getDisplayAbbreviation(unit.abbreviation)}
      </span>
    </div>
    <div className="min-w-0">
      <p className="text-foreground text-sm font-semibold leading-tight">
        {unit.name}
      </p>
      <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
        {getUnitDescription(unit)}
      </p>
    </div>
  </button>
);

const IntensityUnitModal = ({
  isOpen,
  onClose,
  onSelect,
}: IntensityUnitModalProps) => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const {
    data: serverIntensityUnits = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["intensityUnits"],
    queryFn: getIntensityUnits,
    enabled: isAuthenticated,
  });

  const intensityUnits: Array<IntensityUnit | GuestIntensityUnit> =
    isAuthenticated ? serverIntensityUnits : GUEST_INTENSITY_UNITS;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="max-h-[85vh] overflow-y-auto border-border/40 sm:max-w-md"
        onOpenAutoFocus={(event) => event.preventDefault()}
        onClick={(event) => event.stopPropagation()}
        data-testid="intensity-unit-modal"
      >
        <DialogHeader className="pr-8">
          <DialogTitle className="text-xl font-bold tracking-tight">
            Select intensity unit
          </DialogTitle>
          <DialogDescription>
            Choose the unit you want to use for this set.
          </DialogDescription>
        </DialogHeader>

        {isAuthenticated && isLoading ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, idx) => (
              <div
                key={idx}
                className="bg-muted h-24 animate-pulse rounded-2xl"
              />
            ))}
          </div>
        ) : null}

        {isAuthenticated && error ? (
          <p className="text-destructive text-center text-sm">
            Failed to load intensity units.
          </p>
        ) : null}

        {(!isAuthenticated || (!isLoading && !error)) && (
          <div className="grid gap-3 sm:grid-cols-2">
            {intensityUnits.map((unit) => (
              <IntensityUnitOption
                key={unit.id}
                unit={unit}
                onSelect={onSelect}
              />
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default IntensityUnitModal;
