import React from "react";
import { Trophy } from "lucide-react";
import type {
  PersonalBestData as PersonalBestInfoType,
  IntensityUnit,
} from "@/features/exercises/api";

interface PersonalBestInfoProps {
  personalBest: PersonalBestInfoType;
  intensityUnit: IntensityUnit;
}

export const PersonalBestInfo: React.FC<PersonalBestInfoProps> = ({
  personalBest,
  intensityUnit,
}) => {
  const prDate = new Date(personalBest.date).toLocaleDateString();

  return (
    <div className="space-y-3">
      <div className="text-warning flex items-center gap-2">
        <Trophy className="h-5 w-5" />
        <span className="text-sm font-medium">Personal Record</span>
      </div>

      <div className="text-muted-foreground text-sm">Achieved on {prDate}</div>

      <div className="space-y-2">
        <div className="flex justify-between">
          <span className="text-muted-foreground text-sm">Weight:</span>
          <span className="text-warning font-medium">
            {personalBest.weight}
            {intensityUnit.abbreviation}
          </span>
        </div>

        <div className="flex justify-between">
          <span className="text-muted-foreground text-sm">Reps:</span>
          <span className="font-medium">{personalBest.reps}</span>
        </div>

        <div className="flex justify-between">
          <span className="text-muted-foreground text-sm">Volume:</span>
          <span className="font-medium">
            {personalBest.volume}
            {intensityUnit.abbreviation}
          </span>
        </div>
      </div>

      <div className="border-t pt-2">
        <p className="text-muted-foreground text-sm">
          Your personal best is{" "}
          <span className="text-warning font-semibold">
            {personalBest.weight}
            {intensityUnit.abbreviation}
          </span>{" "}
          for <span className="font-semibold">{personalBest.reps} reps</span>
        </p>
      </div>
    </div>
  );
};
