import { Link } from "react-router-dom";
import { Tag, Wrench } from "lucide-react";
import { NAV_PATHS } from "@/shared/navigation/constants";

interface ExerciseSummaryCardProps {
  id: number;
  name: string;
  description?: string | null;
  equipment?: string | null;
  category?: string | null;
  muscles?: Array<{ id: number; name: string } | string>;
  subtitle?: string;
  className?: string;
}

export const ExerciseSummaryCard = ({
  id,
  name,
  description,
  equipment,
  category,
  muscles,
  subtitle,
  className = "",
}: ExerciseSummaryCardProps) => {
  const musclesList = muscles || [];

  return (
    <Link
      to={`${NAV_PATHS.EXERCISES}/${id}`}
      className={`group rounded-2xl border border-border/40 p-4 transition-colors hover:border-primary/40 hover:bg-muted/30 ${className}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-foreground md:text-base">
            {name}
          </h3>
          {subtitle && (
            <p className="text-muted-foreground mt-1 text-[10px] font-semibold uppercase tracking-[0.14em] md:text-[11px]">
              {subtitle}
            </p>
          )}
        </div>
      </div>

      {description && (
        <p className="text-muted-foreground mt-2 text-xs leading-relaxed">
          {description}
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
        {equipment && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1">
            <Wrench className="h-3 w-3" />
            <span className="capitalize">{equipment}</span>
          </span>
        )}
        {category && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1">
            <Tag className="h-3 w-3" />
            <span className="capitalize">{category}</span>
          </span>
        )}
      </div>

      {musclesList.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {musclesList.slice(0, 3).map((muscle) => {
            const muscleName = typeof muscle === "string" ? muscle : muscle.name;
            const muscleId = typeof muscle === "string" ? muscle : muscle.id;
            return (
              <span
                key={muscleId}
                className="inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary/80"
              >
                {muscleName}
              </span>
            );
          })}
        </div>
      )}
    </Link>
  );
};
