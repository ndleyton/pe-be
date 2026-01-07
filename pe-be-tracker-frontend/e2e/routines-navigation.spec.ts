import { test, expect } from "@playwright/test";
import { seedGuestData } from "./utils/storage";

test.describe("Routines quick-start navigation", () => {
  test("clicking More in RoutinesSection navigates to /routines", async ({
    page,
  }) => {
    await seedGuestData(page, {
      workouts: [],
      exerciseTypes: [
        {
          id: "1",
          name: "Push-ups",
          description: null,
          default_intensity_unit: 1,
          times_used: 0,
        },
      ],
      workoutTypes: [
        { id: "8", name: "Other", description: "General workout session" },
      ],
      routines: [
        {
          id: "routine-1",
          name: "Test Routine",
          exercises: [
            {
              id: "ex-1",
              exercise_type_id: "1",
              exercise_type: {
                id: "1",
                name: "Push-ups",
                description: "",
                default_intensity_unit: 1,
                times_used: 0,
              },
              sets: [
                {
                  id: "set-1",
                  reps: 10,
                  intensity: 0,
                  intensity_unit_id: 1,
                  rest_time_seconds: null,
                },
              ],
              notes: null,
            },
          ],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ],
    });

    // Stub routines API to avoid network dependency when navigating to /routines
    await page.route("**/routines*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            id: 1,
            name: "Server Routine",
            description: "Sample",
            workout_type_id: 1,
            creator_id: 1,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            exercise_templates: [],
          },
        ]),
      });
    });

    // Load the workouts page where the RoutinesSection is rendered
    await page.goto("/workouts");

    // Open the accordion to reveal the More link
    const accordionTrigger = page.getByRole("button", {
      name: "Quick Start Routines",
    });
    await expect(accordionTrigger).toBeVisible({ timeout: 15000 });
    await accordionTrigger.click();

    // Click the "More" link button (locate by href for robustness)
    const moreLink = page.locator('a[href="/routines"]').first();
    await expect(moreLink).toBeVisible({ timeout: 10000 });
    await moreLink.click();

    // Verify navigation to /routines
    await expect(page).toHaveURL(/\/routines$/);

    // Optional: basic assertion that routines list page rendered
    await expect(
      page.getByRole("heading", { name: "Routines", level: 1 }),
    ).toBeVisible();
  });
});
