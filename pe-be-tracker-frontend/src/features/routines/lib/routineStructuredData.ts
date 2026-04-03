import type { Routine } from "@/features/routines/types";

type JsonLdValue = string | number | boolean | null | JsonLdObject | JsonLdValue[];
export type JsonLdObject = {
  [key: string]: JsonLdValue | undefined;
};

const DEFAULT_ORIGIN = "https://app.personalbestie.com";

const getBaseUrl = (baseUrl?: string) =>
  baseUrl ??
  (typeof window !== "undefined" ? window.location.origin : DEFAULT_ORIGIN);

const toAbsoluteUrl = (path: string, baseUrl?: string) =>
  new URL(path, getBaseUrl(baseUrl)).href;

const getExerciseSummaries = (routine: Routine) =>
  routine.exercise_templates.map((template) => {
    const exerciseName = template.exercise_type?.name ?? "Unknown exercise";
    const setCount = template.set_templates.length;
    return `${exerciseName}: ${setCount} set${setCount === 1 ? "" : "s"}`;
  });

export const buildRoutineCollectionJsonLd = (
  routines: Routine[],
  baseUrl?: string,
): JsonLdObject => ({
  "@context": "https://schema.org",
  "@type": "CollectionPage",
  name: "Routines",
  description:
    "Browse workout routines and quick-start templates that support your personalized AI coach.",
  url: toAbsoluteUrl("/routines", baseUrl),
  mainEntity: {
    "@type": "ItemList",
    numberOfItems: routines.length,
    itemListElement: routines.map((routine, index) => ({
      "@type": "ListItem",
      position: index + 1,
      url: toAbsoluteUrl(`/routines/${routine.id}`, baseUrl),
      name: routine.name,
      description: routine.description ?? undefined,
    })),
  },
});

export const buildRoutineExercisePlanJsonLd = (
  routine: Routine,
  baseUrl?: string,
): JsonLdObject => {
  const totalExercises = routine.exercise_templates.length;
  const totalSets = routine.exercise_templates.reduce(
    (total, exercise) => total + exercise.set_templates.length,
    0,
  );
  const exerciseSummaries = getExerciseSummaries(routine);

  return {
    "@context": "https://schema.org",
    "@type": "ExercisePlan",
    name: routine.name,
    description:
      routine.description ??
      "A workout routine that feeds PersonalBestie's AI coaching and post-workout recap flow.",
    url: toAbsoluteUrl(`/routines/${routine.id}`, baseUrl),
    mainEntityOfPage: toAbsoluteUrl(`/routines/${routine.id}`, baseUrl),
    about: "Personalized AI coaching",
    additionalVariable: [
      `${totalExercises} exercise${totalExercises === 1 ? "" : "s"}`,
      `${totalSets} total set${totalSets === 1 ? "" : "s"}`,
      ...exerciseSummaries,
    ],
  };
};
