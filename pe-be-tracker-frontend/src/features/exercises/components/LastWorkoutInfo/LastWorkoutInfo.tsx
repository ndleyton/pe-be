import React from 'react';
import type { LastWorkoutInfo as LastWorkoutInfoType, IntensityUnit } from '@/api/exercises';

interface LastWorkoutInfoProps {
  lastWorkout: LastWorkoutInfoType;
  intensityUnit: IntensityUnit;
}

export const LastWorkoutInfo: React.FC<LastWorkoutInfoProps> = ({ lastWorkout, intensityUnit }) => {
  const workoutDate = new Date(lastWorkout.date).toLocaleDateString();
  
  return (
    <div className="space-y-3">
      <div className="text-sm text-gray-600">
        {workoutDate}
      </div>
      
      <div className="space-y-2">
        <div className="flex justify-between">
          <span className="text-sm text-gray-600">Sets:</span>
          <span className="font-medium">{lastWorkout.sets}</span>
        </div>
        
        <div className="flex justify-between">
          <span className="text-sm text-gray-600">Total Reps:</span>
          <span className="font-medium">{lastWorkout.totalReps}</span>
        </div>
        
        <div className="flex justify-between">
          <span className="text-sm text-gray-600">Max Weight:</span>
          <span className="font-medium">
            {lastWorkout.maxWeight}{intensityUnit.abbreviation}
          </span>
        </div>
        
        <div className="flex justify-between">
          <span className="text-sm text-gray-600">Total Volume:</span>
          <span className="font-medium">
            {lastWorkout.totalVolume}{intensityUnit.abbreviation}
          </span>
        </div>
      </div>

      <div className="pt-2 border-t">
        <p className="text-sm text-gray-700">
          Last time you did <span className="font-semibold">{lastWorkout.sets} sets</span> with{' '}
          <span className="font-semibold">{lastWorkout.maxWeight}{intensityUnit.abbreviation}</span> max weight
        </p>
      </div>
    </div>
  );
};