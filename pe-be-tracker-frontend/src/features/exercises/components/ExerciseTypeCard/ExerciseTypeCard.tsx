import React from 'react';
import { Link } from 'react-router-dom';
import { Eye, Flame } from 'lucide-react';
import type { ExerciseType } from '@/features/exercises/api';
import { MUSCLE_DISPLAY_LIMIT } from '@/shared/constants';

interface ExerciseTypeCardProps {
  exerciseType: ExerciseType;
}

export const ExerciseTypeCard: React.FC<ExerciseTypeCardProps> = ({ exerciseType }) => {
  const { id, name, description, times_used, muscles } = exerciseType;

  return (
    <Link to={`/exercise-types/${id}`} className="block group">
      <div className="bg-card rounded-2xl p-6 shadow-md border border-border/20 hover:shadow-lg hover:border-border/40 transition-all duration-200 cursor-pointer">
        <h3 className="text-lg font-semibold mb-2 leading-tight">{name}</h3>

        {description && (
          <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
            {description}
          </p>
        )}

        {muscles && muscles.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-4">
            {muscles.slice(0, MUSCLE_DISPLAY_LIMIT).map((muscle) => (
              <span
                key={muscle.id}
                className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80"
              >
                {muscle.name}
              </span>
            ))}
            {muscles.length > MUSCLE_DISPLAY_LIMIT && (
              <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80">
                +{muscles.length - MUSCLE_DISPLAY_LIMIT} more
              </span>
            )}
          </div>
        )}

        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <Flame className="h-4 w-4" />
            <span>{times_used} times used</span>
          </div>

          <div className="flex items-center gap-1 text-primary/70 group-hover:text-primary transition-colors">
            <Eye className="h-4 w-4" />
            <span>View Details</span>
          </div>
        </div>
      </div>
    </Link>
  );
};