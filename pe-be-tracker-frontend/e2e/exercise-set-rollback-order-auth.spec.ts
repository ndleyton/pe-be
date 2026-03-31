import { expect, test } from "@playwright/test";

test.describe("Exercise set rollback ordering (authenticated)", () => {
  test("keeps set rows stable after a failed update refetches reversed payload order", async ({
    page,
  }) => {
    const workoutId = 1001;
    const exerciseId = 2001;
    const now = "2026-03-31T01:00:00.000Z";

    let exercisesRequestCount = 0;
    let updateRequestCount = 0;

    const exerciseResponse = (reverseSets: boolean) => [
      {
        id: exerciseId,
        timestamp: now,
        notes: null,
        exercise_type_id: 301,
        workout_id: workoutId,
        created_at: now,
        updated_at: now,
        exercise_type: {
          id: 301,
          name: "Bench Press",
          description: null,
          muscle_groups: ["Chest", "Triceps"],
          equipment: "Barbell",
          instructions: null,
          category: "Strength",
          created_at: now,
          updated_at: now,
          usage_count: 0,
          default_intensity_unit: 1,
          times_used: 0,
        },
        exercise_sets: reverseSets
          ? [
              {
                id: 2,
                reps: 5,
                intensity: 200,
                intensity_unit_id: 1,
                exercise_id: exerciseId,
                rest_time_seconds: 90,
                done: false,
                notes: null,
                type: "working",
                created_at: "2026-03-31T01:02:00.000Z",
                updated_at: "2026-03-31T01:02:00.000Z",
              },
              {
                id: 1,
                reps: 8,
                intensity: 100,
                intensity_unit_id: 1,
                exercise_id: exerciseId,
                rest_time_seconds: 90,
                done: false,
                notes: null,
                type: "warmup",
                created_at: "2026-03-31T01:01:00.000Z",
                updated_at: "2026-03-31T01:01:00.000Z",
              },
            ]
          : [
              {
                id: 1,
                reps: 8,
                intensity: 100,
                intensity_unit_id: 1,
                exercise_id: exerciseId,
                rest_time_seconds: 90,
                done: false,
                notes: null,
                type: "warmup",
                created_at: "2026-03-31T01:01:00.000Z",
                updated_at: "2026-03-31T01:01:00.000Z",
              },
              {
                id: 2,
                reps: 5,
                intensity: 200,
                intensity_unit_id: 1,
                exercise_id: exerciseId,
                rest_time_seconds: 90,
                done: false,
                notes: null,
                type: "working",
                created_at: "2026-03-31T01:02:00.000Z",
                updated_at: "2026-03-31T01:02:00.000Z",
              },
            ],
      },
    ];

    await page.route("**/api/v1/auth/session", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: 1,
          email: "tester@example.com",
          name: "Tester",
        }),
      });
    });

    await page.route(`**/api/v1/workouts/${workoutId}`, (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: workoutId,
          name: "Rollback Order Workout",
          notes: null,
          start_time: now,
          end_time: null,
          workout_type_id: 1,
          created_at: now,
          updated_at: now,
        }),
      });
    });

    await page.route(`**/api/v1/workouts/${workoutId}/exercises`, (route) => {
      exercisesRequestCount += 1;
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(exerciseResponse(exercisesRequestCount > 1)),
      });
    });

    await page.route("**/api/v1/exercise-sets/1", (route) => {
      if (route.request().method() !== "PUT") {
        return route.continue();
      }

      updateRequestCount += 1;
      route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ detail: "forced rollback" }),
      });
    });

    await page.goto(`/workouts/${workoutId}`);
    await expect(
      page.getByRole("heading", { name: "Rollback Order Workout" }),
    ).toBeVisible();

    const intensityInputs = page.getByTestId("intensity-input");
    await expect(intensityInputs).toHaveCount(2);
    await expect(intensityInputs.nth(0)).toHaveValue("100");
    await expect(intensityInputs.nth(1)).toHaveValue("200");

    await intensityInputs.nth(0).fill("111");
    await intensityInputs.nth(0).press("Enter");

    await expect.poll(() => updateRequestCount).toBe(1);
    await expect.poll(() => exercisesRequestCount).toBe(2);

    await expect(intensityInputs.nth(0)).toHaveValue("100");
    await expect(intensityInputs.nth(1)).toHaveValue("200");
  });
});
