
import { Link } from "react-router-dom";
import { Eye } from "lucide-react";
import type { ExerciseType } from "@/features/exercises/api";
import { MUSCLE_DISPLAY_LIMIT } from "@/shared/constants";

interface ExerciseTypeCardProps {
  exerciseType: ExerciseType;
}

export const ExerciseTypeCard = ({ exerciseType }: ExerciseTypeCardProps) => {
  const { id, name, description, muscles } = exerciseType;

  return (
    <Link to={`/exercise-types/${id}`} className="group block">
      <div className="bg-card border-border/20 hover:border-border/40 cursor-pointer rounded-2xl border p-6 shadow-md transition-all duration-200 hover:shadow-lg">
        <div className="mb-2 flex items-center gap-2">
          <h3 className="text-lg leading-tight font-semibold">{name}</h3>
        </div>

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

        <div className="text-muted-foreground flex justify-end text-sm">
          <div className="text-primary/70 group-hover:text-primary flex items-center gap-1 transition-colors">
            <Eye className="h-4 w-4" />
            <span>View Details</span>
          </div>
        </div>
      </div>
    </Link>
  );
};
