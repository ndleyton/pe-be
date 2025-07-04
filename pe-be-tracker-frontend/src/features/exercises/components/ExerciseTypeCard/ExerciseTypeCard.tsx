import React from 'react';
import { Link } from 'react-router-dom';
import { Eye, Flame } from 'lucide-react';
import type { ExerciseType } from '@/api/exercises';
import {
  Card,
  CardContent,
  CardTitle,
} from '@/components/ui/card';

interface ExerciseTypeCardProps {
  exerciseType: ExerciseType;
}

export const ExerciseTypeCard: React.FC<ExerciseTypeCardProps> = ({ exerciseType }) => {
  const { id, name, description, times_used, muscles } = exerciseType;

  return (
    <Link to={`/exercise-types/${id}`} className="block">
      <Card className="shadow-md hover:shadow-lg transition-shadow duration-200 cursor-pointer">
        <CardContent className="pt-6">
          <CardTitle className="text-lg font-semibold">{name}</CardTitle>
          
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
                  className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80"
                >
                  {muscle.name}
                </span>
              ))}
              {muscles.length > 3 && (
                <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80">
                  +{muscles.length - 3} more
                </span>
              )}
            </div>
          )}
          
          <div className="flex items-center justify-between text-sm text-gray-500">
            <div className="flex items-center gap-1">
              <Flame className="h-4 w-4" />
              <span>{times_used} times used</span>
            </div>
            
            <div className="flex items-center gap-1">
              <Eye className="h-4 w-4" />
              <span>View Details</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
};