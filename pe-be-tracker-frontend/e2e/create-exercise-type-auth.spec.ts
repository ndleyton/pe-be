import { test, expect } from "@playwright/test";

// Verifies creating an exercise type posts to the trailing-slash endpoint
// /api/v1/exercises/exercise-types/ without a 307 redirect.

test.describe("Create Exercise Type (authenticated)", () => {
  test("creates via /exercises/exercise-types/ without redirect", async ({ page }) => {
    const workoutId = 2002;
    const now = new Date().toISOString();
    const newTypeName = `E2E New Type ${Date.now()}`;

    let trailingCalled = false;
    let badNoSlashCalled = false;
    const redirectResponses: string[] = [];

    // Track redirects (should be none)
    page.on("response", (res) => {
      if (res.status() === 307 && res.url().includes("/exercises/exercise-types")) {
        redirectResponses.push(res.url());
      }
    });

    // Mock authenticated user
    await page.route("**/api/v1/users/me", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ id: 1, email: "tester@example.com", name: "Tester" }),
      });
    });

    // Mock workout and empty exercises
    await page.route(`**/api/v1/workouts/${workoutId}`, (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: workoutId,
          name: "Auth Test Workout",
          notes: null,
          start_time: now,
          end_time: null,
          created_at: now,
          updated_at: now,
        }),
      });
    });
    await page.route(`**/api/v1/workouts/${workoutId}/exercises`, (route) => {
      route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
    });

    // Provide an initial exercise types list that won't match our new name
    await page.route("**/api/v1/exercises/exercise-types/**", (route) => {
      if (route.request().method() === "GET") {
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ data: [], next_cursor: null }),
        });
        return;
      }
      route.continue();
    });

    // Intentionally fail no-trailing-slash POST if it occurs
    await page.route("**/api/v1/exercises/exercise-types", (route) => {
      badNoSlashCalled = true;
      route.fulfill({ status: 400, body: JSON.stringify({ detail: "Bad path" }) });
    });

    // Handle the canonical trailing-slash POST
    await page.route("**/api/v1/exercises/exercise-types/", async (route) => {
      if (route.request().method() !== "POST") return route.continue();
      trailingCalled = true;
      const created = {
        id: 5010,
        name: newTypeName,
        description: "Created by E2E",
        default_intensity_unit: 1,
        times_used: 0,
        muscle_groups: [],
        equipment: null,
        instructions: null,
        category: null,
        created_at: now,
        updated_at: now,
      };
      route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify(created) });
    });

    // Navigate to workout and open the ExerciseType modal via "Add Exercise"
    await page.goto(`/workouts/${workoutId}`);
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("button", { name: "Add Exercise" })).toBeVisible();
    await page.getByRole("button", { name: "Add Exercise" }).click();
    await expect(page.getByRole("heading", { name: "Select Exercise Type" })).toBeVisible();

    // Type a unique, non-matching name to reveal the create button
    await page.getByPlaceholder("Search exercise types...").fill(newTypeName);

    // Click the create button (has a title attribute)
    await page.getByTitle(`Create "${newTypeName}"`).click();

    // Wait for the POST and assert endpoint correctness
    await expect.poll(() => trailingCalled).toBe(true);
    expect(badNoSlashCalled).toBe(false);
    expect(redirectResponses.length).toBe(0);

    // Modal should close after selecting the newly created type
    await expect(
      page.getByRole("heading", { name: "Select Exercise Type" }),
    ).toBeHidden();
  });
});
