import React from 'react';
import { Trophy } from 'lucide-react';
import type { PersonalBestData as PersonalBestInfoType, IntensityUnit } from '@/features/exercises/api';

interface PersonalBestInfoProps {
  personalBest: PersonalBestInfoType;
  intensityUnit: IntensityUnit;
}

export const PersonalBestInfo: React.FC<PersonalBestInfoProps> = ({ personalBest, intensityUnit }) => {
  const prDate = new Date(personalBest.date).toLocaleDateString();
  
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-warning">
        <Trophy className="h-5 w-5" />
        <span className="text-sm font-medium">Personal Record</span>
      </div>
      
      <div className="text-sm text-muted-foreground">
        Achieved on {prDate}
      </div>
      
      <div className="space-y-2">
        <div className="flex justify-between">
          <span className="text-sm text-muted-foreground">Weight:</span>
          <span className="font-medium text-warning">
            {personalBest.weight}{intensityUnit.abbreviation}
          </span>
        </div>
        
        <div className="flex justify-between">
          <span className="text-sm text-muted-foreground">Reps:</span>
          <span className="font-medium">{personalBest.reps}</span>
        </div>
        
        <div className="flex justify-between">
          <span className="text-sm text-muted-foreground">Volume:</span>
          <span className="font-medium">
            {personalBest.volume}{intensityUnit.abbreviation}
          </span>
        </div>
      </div>

      <div className="pt-2 border-t">
        <p className="text-sm text-muted-foreground">
          Your personal best is{' '}
          <span className="font-semibold text-warning">
            {personalBest.weight}{intensityUnit.abbreviation}
          </span>{' '}
          for <span className="font-semibold">{personalBest.reps} reps</span>
        </p>
      </div>
    </div>
  );
};