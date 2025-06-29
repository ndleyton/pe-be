import React from 'react';
import { Link } from 'react-router-dom';
import { HiOutlineEye, HiOutlineFire } from 'react-icons/hi2';
import type { ExerciseType } from '@/api/exercises';

interface ExerciseTypeCardProps {
  exerciseType: ExerciseType;
}

export const ExerciseTypeCard: React.FC<ExerciseTypeCardProps> = ({ exerciseType }) => {
  const { id, name, description, times_used, muscles } = exerciseType;

  return (
    <Link to={`/exercise-types/${id}`} className="block">
      <div className="card bg-base-100 shadow-md hover:shadow-lg transition-shadow duration-200 cursor-pointer">
        <div className="card-body">
          <h3 className="card-title text-lg font-semibold">{name}</h3>
          
          {description && (
            <p className="text-sm text-gray-600 line-clamp-2 mb-2">
              {description}
            </p>
          )}
          
          {muscles && muscles.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-3">
              {muscles.slice(0, 3).map((muscle) => (
                <span
                  key={muscle.id}
                  className="badge badge-outline badge-sm"
                >
                  {muscle.name}
                </span>
              ))}
              {muscles.length > 3 && (
                <span className="badge badge-outline badge-sm">
                  +{muscles.length - 3} more
                </span>
              )}
            </div>
          )}
          
          <div className="flex items-center justify-between text-sm text-gray-500">
            <div className="flex items-center gap-1">
              <HiOutlineFire className="h-4 w-4" />
              <span>{times_used} times used</span>
            </div>
            
            <div className="flex items-center gap-1">
              <HiOutlineEye className="h-4 w-4" />
              <span>View Details</span>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
};