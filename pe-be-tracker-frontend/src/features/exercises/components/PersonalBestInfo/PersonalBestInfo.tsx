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
      <div className="flex items-center gap-2 text-amber-600">
        <Trophy className="h-5 w-5" />
        <span className="text-sm font-medium">Personal Record</span>
      </div>
      
      <div className="text-sm text-gray-600">
        Achieved on {prDate}
      </div>
      
      <div className="space-y-2">
        <div className="flex justify-between">
          <span className="text-sm text-gray-600">Weight:</span>
          <span className="font-medium text-amber-600">
            {personalBest.weight}{intensityUnit.abbreviation}
          </span>
        </div>
        
        <div className="flex justify-between">
          <span className="text-sm text-gray-600">Reps:</span>
          <span className="font-medium">{personalBest.reps}</span>
        </div>
        
        <div className="flex justify-between">
          <span className="text-sm text-gray-600">Volume:</span>
          <span className="font-medium">
            {personalBest.volume}{intensityUnit.abbreviation}
          </span>
        </div>
      </div>

      <div className="pt-2 border-t">
        <p className="text-sm text-gray-700">
          Your personal best is{' '}
          <span className="font-semibold text-amber-600">
            {personalBest.weight}{intensityUnit.abbreviation}
          </span>{' '}
          for <span className="font-semibold">{personalBest.reps} reps</span>
        </p>
      </div>
    </div>
  );
};