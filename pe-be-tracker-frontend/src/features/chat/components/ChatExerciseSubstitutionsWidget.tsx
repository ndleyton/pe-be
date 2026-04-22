import { MessageCircle } from "lucide-react";
import { ExerciseSummaryCard } from "@/features/exercises/components/ExerciseSummaryCard";
import { ExerciseSubstitutionsEvent, ExerciseSubstitutionItem } from "../types";

const substitutionReasonLabel: Record<
  ExerciseSubstitutionItem["matchReason"],
  string
> = {
  same_primary_muscle: "Same primary muscle",
  same_primary_muscle_group: "Same muscle group",
};

export const ChatExerciseSubstitutionsWidget = ({
  event,
}: {
  event: ExerciseSubstitutionsEvent;
}) => {
  return (
    <div className="bg-background/70 border-border/40 mt-3 rounded-2xl border p-3">
      <div className="flex items-start gap-3">
        <div className="bg-primary/10 text-primary flex h-10 w-10 shrink-0 items-center justify-center rounded-xl">
          <MessageCircle className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-muted-foreground text-[11px] font-semibold uppercase tracking-[0.16em]">
            {event.title ?? "Recommended substitutions"}
          </p>
          <p className="text-foreground mt-1 text-sm font-semibold">
            Alternatives to {event.sourceExercise.name}
          </p>
        </div>
      </div>

      <div className="mt-3 grid gap-3">
        {event.substitutions.map((substitution) => (
          <ExerciseSummaryCard
            key={substitution.id}
            id={substitution.id}
            name={substitution.name}
            description={substitution.description}
            equipment={substitution.equipment}
            category={substitution.category}
            muscles={substitution.muscles}
            subtitle={substitutionReasonLabel[substitution.matchReason]}
          />
        ))}
      </div>
    </div>
  );
};
