
import { Link } from "react-router-dom";
import type { ExerciseType } from "@/features/exercises/api";
import { MUSCLE_DISPLAY_LIMIT } from "@/shared/constants";
import { createIntentPreload } from "@/shared/lib/createIntentPreload";

const preloadExerciseTypeDetailsPage = createIntentPreload(() =>
  import("@/features/exercises/pages"),
);

interface ExerciseTypeCardProps {
  exerciseType: ExerciseType;
}

export const ExerciseTypeCard = ({ exerciseType }: ExerciseTypeCardProps) => {
  const { id, name, description, muscles } = exerciseType;

  return (
    <Link
      to={`/exercise-types/${id}`}
      className="group relative block transition-all"
      onMouseEnter={preloadExerciseTypeDetailsPage}
      onTouchStart={preloadExerciseTypeDetailsPage}
      onFocus={preloadExerciseTypeDetailsPage}
    >
      <div className="relative flex h-full flex-col overflow-hidden rounded-2xl border border-border/40 bg-card/60 p-6 backdrop-blur-md transition-all duration-300 hover:scale-[1.02] hover:border-primary/30 hover:shadow-2xl hover:shadow-primary/5 active:scale-[0.98]">
        {/* Decorative background glow */}
        <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-primary/5 opacity-0 transition-opacity duration-500 group-hover:opacity-100" />

        <div className="relative mb-4 flex items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary font-bold text-xl shadow-inner transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
            {name.charAt(0)}
          </div>
          <div className="min-w-0">
            <h3 className="truncate text-lg font-bold leading-tight tracking-tight text-foreground transition-colors group-hover:text-primary">
              {name}
            </h3>
          </div>
        </div>

        {description && (
          <p className="text-muted-foreground relative mb-6 line-clamp-2 text-sm font-medium leading-relaxed opacity-70 transition-opacity group-hover:opacity-100">
            {description}
          </p>
        )}

        <div className="mt-auto relative">
          {muscles && muscles.length > 0 && (
            <div className="flex flex-wrap gap-1.5 grayscale-[0.3] transition-all group-hover:grayscale-0">
              {muscles.slice(0, MUSCLE_DISPLAY_LIMIT).map((muscle) => (
                <span
                  key={muscle.id}
                  className="inline-flex items-center rounded-lg bg-secondary/80 px-2.5 py-1 text-[10px] font-bold text-secondary-foreground border border-border/20"
                >
                  {muscle.name}
                </span>
              ))}
              {muscles.length > MUSCLE_DISPLAY_LIMIT && (
                <span className="inline-flex items-center rounded-lg bg-secondary/40 px-2.5 py-1 text-[10px] font-bold text-muted-foreground border border-border/10">
                  +{muscles.length - MUSCLE_DISPLAY_LIMIT}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </Link>
  );
};
