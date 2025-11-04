import { test, expect } from "@playwright/test";

// This E2E verifies the authenticated "Add Exercise" flow uses the canonical
// trailing-slash endpoint (no 307 redirect) when creating an exercise.
// It mocks the API responses so no backend is required.

test.describe("Add Exercise (authenticated)", () => {
  test("posts to /exercises/ without redirect", async ({ page }) => {
    const workoutId = 1001;
    const now = new Date().toISOString();

    let trailingCalled = false;
    let badNoSlashCalled = false;
    const redirectResponses: string[] = [];
    const exerciseRequestUrls: string[] = [];

    // Track requests and potential redirects
    page.on("request", (req) => {
      if (req.method() === "POST" && req.url().includes("/exercises")) {
        exerciseRequestUrls.push(req.url());
      }
    });
    page.on("response", (res) => {
      if (res.status() === 307 && res.url().includes("/exercises")) {
        redirectResponses.push(res.url());
      }
    });

    // Mock authenticated session
    await page.route("**/api/v1/users/me", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ id: 1, email: "tester@example.com", name: "Tester" }),
      });
    });

    // Mock workout detail + empty exercises list
    await page.route(`**/api/v1/workouts/${workoutId}`, (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: workoutId,
          name: "Test Workout",
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

    // Mock exercise types for the selection modal
    // Handle both with and without trailing slash just in case
    const fulfillExerciseTypes = (route: any) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: [
            {
              id: 999,
              name: "Push-ups",
              description: null,
              muscle_groups: ["Chest", "Triceps"],
              equipment: null,
              instructions: null,
              category: null,
              created_at: now,
              updated_at: now,
              usage_count: 0,
              default_intensity_unit: 1,
              times_used: 0,
              images: [],
              muscles: [
                { id: 1, name: "Pectoralis Major" },
                { id: 2, name: "Triceps Brachii" },
              ],
            },
          ],
          next_cursor: null,
        }),
      });
    await page.route("**/api/v1/exercises/exercise-types/**", (route) => {
      if (route.request().method() === "GET") return fulfillExerciseTypes(route);
      return route.continue();
    });
    await page.route("**/api/v1/exercises/exercise-types?**", (route) => {
      if (route.request().method() === "GET") return fulfillExerciseTypes(route);
      return route.continue();
    });

    // Fail the no-trailing-slash POST if it ever occurs
    await page.route("**/api/v1/exercises", (route) => {
      // Only exact path without slash should hit this (order matters in routing)
      badNoSlashCalled = true;
      route.fulfill({ status: 400, body: JSON.stringify({ detail: "Bad path" }) });
    });

    // Handle the canonical trailing-slash POST
    await page.route("**/api/v1/exercises/", (route) => {
      trailingCalled = true;
      const created = {
        id: 2001,
        timestamp: now,
        notes: null,
        exercise_type_id: 999,
        workout_id: workoutId,
        created_at: now,
        updated_at: now,
        exercise_type: {
          id: 999,
          name: "Push-ups",
          description: null,
          muscle_groups: ["Chest", "Triceps"],
          equipment: null,
          instructions: null,
          category: null,
          created_at: now,
          updated_at: now,
          usage_count: 0,
          default_intensity_unit: 1,
          times_used: 0,
          images: [],
          muscles: [
            { id: 1, name: "Pectoralis Major" },
            { id: 2, name: "Triceps Brachii" },
          ],
        },
        exercise_sets: [],
      };
      route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify(created),
      });
    });

    // Navigate directly to a workout page (authenticated path)
    await page.goto(`/workouts/${workoutId}`);
    await page.waitForLoadState("networkidle");

    // Ensure page is ready and shows the Add Exercise button
    await expect(page.getByRole("button", { name: "Add Exercise" })).toBeVisible();

    // Open exercise type modal and select Push-ups
    await page.getByRole("button", { name: "Add Exercise" }).click();
    await expect(
      page.getByRole("heading", { name: "Select Exercise Type" }),
    ).toBeVisible();
    await page.getByPlaceholder("Search exercise types...").fill("Push");
    await expect(page.getByText("Push-ups", { exact: true })).toBeVisible();
    await page.getByText("Push-ups", { exact: true }).click();

    // Wait for the POST to be made
    await expect.poll(() => trailingCalled).toBe(true);

    // Assertions: we used the trailing-slash endpoint and saw no 307 redirects
    expect(badNoSlashCalled).toBe(false);
    expect(redirectResponses.length).toBe(0);
    // And the request URL for the exercise creation should end with '/exercises/'
    const createdUrl = exerciseRequestUrls.find((u) => u.includes("/exercises"));
    expect(createdUrl).toBeDefined();
    expect(createdUrl!.endsWith("/exercises/")).toBe(true);
  });
});
