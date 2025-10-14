import React from "react";
import { Link } from "react-router-dom";
import { Eye, Flame } from "lucide-react";
import type { ExerciseType } from "@/features/exercises/api";
import { MUSCLE_DISPLAY_LIMIT } from "@/shared/constants";

interface ExerciseTypeCardProps {
  exerciseType: ExerciseType;
}

export const ExerciseTypeCard: React.FC<ExerciseTypeCardProps> = ({
  exerciseType,
}) => {
  const { id, name, description, times_used, muscles } = exerciseType;

  return (
    <Link to={`/exercise-types/${id}`} className="group block">
      <div className="bg-card border-border/20 hover:border-border/40 cursor-pointer rounded-2xl border p-6 shadow-md transition-all duration-200 hover:shadow-lg">
        <h3 className="mb-2 text-lg leading-tight font-semibold">{name}</h3>

        {description && (
          <p className="text-muted-foreground mb-3 line-clamp-2 text-sm">
            {description}
          </p>
        )}

        {muscles && muscles.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-1">
            {muscles.slice(0, MUSCLE_DISPLAY_LIMIT).map((muscle) => (
              <span
                key={muscle.id}
                className="focus:ring-ring bg-secondary text-secondary-foreground hover:bg-secondary/80 inline-flex items-center rounded-full border border-transparent px-2.5 py-0.5 text-xs font-semibold transition-colors focus:ring-2 focus:ring-offset-2 focus:outline-none"
              >
                {muscle.name}
              </span>
            ))}
            {muscles.length > MUSCLE_DISPLAY_LIMIT && (
              <span className="focus:ring-ring bg-secondary text-secondary-foreground hover:bg-secondary/80 inline-flex items-center rounded-full border border-transparent px-2.5 py-0.5 text-xs font-semibold transition-colors focus:ring-2 focus:ring-offset-2 focus:outline-none">
                +{muscles.length - MUSCLE_DISPLAY_LIMIT} more
              </span>
            )}
          </div>
        )}

        <div className="text-muted-foreground flex items-center justify-between text-sm">
          <div className="flex items-center gap-1">
            <Flame className="h-4 w-4" />
            <span>{times_used} times used</span>
          </div>

          <div className="text-primary/70 group-hover:text-primary flex items-center gap-1 transition-colors">
            <Eye className="h-4 w-4" />
            <span>View Details</span>
          </div>
        </div>
      </div>
    </Link>
  );
};
