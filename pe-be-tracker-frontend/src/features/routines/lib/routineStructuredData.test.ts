import { describe, expect, it } from "vitest";

import {
  makeRoutine,
  makeRoutineExerciseTemplate,
  makeRoutineSetTemplate,
} from "@/test/fixtures";

import {
  buildRoutineCollectionJsonLd,
  buildRoutineExercisePlanJsonLd,
} from "./routineStructuredData";

describe("routine structured data", () => {
  it("builds collection page JSON-LD for routines", () => {
    const hypertrophyRoutine = makeRoutine({
      id: 1,
      name: "Hypertrophy Routine",
      description: "A structured hypertrophy plan.",
    });
    const pushPullLegRoutine = makeRoutine({
      id: 2,
      name: "Push Pull Legs",
      description: "A balanced push/pull/legs split.",
      exercise_templates: [
        makeRoutineExerciseTemplate({
          exercise_type: {
            id: 2,
            name: "Bench Press",
            description: "Compound chest press",
            default_intensity_unit: 1,
            times_used: 9,
          },
          set_templates: [makeRoutineSetTemplate({ id: 21 })],
        }),
      ],
    });

    const jsonLd = buildRoutineCollectionJsonLd(
      [hypertrophyRoutine, pushPullLegRoutine],
      "https://example.com",
    );

    expect(jsonLd).toEqual({
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      description:
        "Browse workout routines and quick-start templates that support your personalized AI coach.",
      mainEntity: {
        "@type": "ItemList",
        itemListElement: [
          {
            "@type": "ListItem",
            description: "A structured hypertrophy plan.",
            name: "Hypertrophy Routine",
            position: 1,
            url: "https://example.com/routines/1",
          },
          {
            "@type": "ListItem",
            description: "A balanced push/pull/legs split.",
            name: "Push Pull Legs",
            position: 2,
            url: "https://example.com/routines/2",
          },
        ],
        numberOfItems: 2,
      },
      name: "Routines",
      url: "https://example.com/routines",
    });
  });

  it("builds exercise plan JSON-LD for a routine detail page", () => {
    const routine = makeRoutine({
      id: 1,
      name: "Hypertrophy Routine",
      description: "A structured hypertrophy plan.",
      exercise_templates: [
        makeRoutineExerciseTemplate({
          exercise_type: {
            id: 1,
            name: "Squat",
            description: "Lower body compound movement",
            default_intensity_unit: 1,
            times_used: 12,
          },
          set_templates: [
            makeRoutineSetTemplate({ id: 11 }),
            makeRoutineSetTemplate({ id: 12 }),
            makeRoutineSetTemplate({ id: 13 }),
          ],
        }),
        makeRoutineExerciseTemplate({
          exercise_type: {
            id: 2,
            name: "Bench Press",
            description: "Upper body compound movement",
            default_intensity_unit: 1,
            times_used: 9,
          },
          set_templates: [
            makeRoutineSetTemplate({ id: 21 }),
            makeRoutineSetTemplate({ id: 22 }),
            makeRoutineSetTemplate({ id: 23 }),
          ],
        }),
        makeRoutineExerciseTemplate({
          exercise_type: {
            id: 3,
            name: "Romanian Deadlift",
            description: "Posterior chain hinge",
            default_intensity_unit: 1,
            times_used: 7,
          },
          set_templates: [
            makeRoutineSetTemplate({ id: 31 }),
            makeRoutineSetTemplate({ id: 32 }),
            makeRoutineSetTemplate({ id: 33 }),
          ],
        }),
      ],
    });

    const jsonLd = buildRoutineExercisePlanJsonLd(
      routine,
      "https://example.com",
    );

    expect(jsonLd).toEqual({
      "@context": "https://schema.org",
      "@type": "ExercisePlan",
      additionalVariable: [
        "3 exercises",
        "9 total sets",
        "Squat: 3 sets",
        "Bench Press: 3 sets",
        "Romanian Deadlift: 3 sets",
      ],
      about: "Personalized AI coaching",
      description: "A structured hypertrophy plan.",
      mainEntityOfPage: "https://example.com/routines/1",
      name: "Hypertrophy Routine",
      url: "https://example.com/routines/1",
    });
  });
});
