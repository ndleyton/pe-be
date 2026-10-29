import { test, expect } from "@playwright/test";
import { openWorkoutForm, renameWorkout } from "./utils/workouts";

test.describe("Guest Mode Landing", () => {
  test("should show workouts page for a guest user", async ({ page }) => {
    // Log all console messages from the browser to the terminal
    page.on("console", (msg) => console.log(`BROWSER LOG: ${msg.text()}`));
    page.on("pageerror", (error) =>
      console.log(`PAGE ERROR: ${error.message}`),
    );

    // Mock the /auth/session API call to simulate a guest user
    await page.route("**/auth/session", (route) => {
      route.fulfill({
        status: 401,
        body: JSON.stringify({ detail: "Not authenticated" }),
      });
    });

    // Navigate to the app (redirects to /workouts)
    await page.goto("/workouts");

    // Wait for the page to be fully loaded
    await page.waitForLoadState("networkidle");

    // Wait for the workouts page heading
    await expect(page.getByRole("heading", {
      name: "Workouts",
      exact: true,
    })).toBeVisible({
      timeout: 10000,
    });

    // Sanity: FAB should be present for adding a workout in guest mode
    await expect(page.getByTestId("fab-add-workout")).toBeVisible({
      timeout: 10000,
    });

    // A guest with no workouts gets no banner yet.
    await page.waitForTimeout(1200);
    await expect(page.getByText(/Guest Mode/i)).toBeHidden();

    // Create a workout; the banner appears once the guest has one.
    await openWorkoutForm(page);
    await renameWorkout(page, `Banner Workout ${Date.now()}`);
    await page.getByTestId("open-workout-type-modal").click();
    await page.getByTestId("workout-type-strength-training").click();
    await page.getByTestId("start-workout-button").click();
    await expect(page).toHaveURL(/\/workouts\/.+/, { timeout: 10000 });

    await page.goto("/workouts");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1200);
    await expect(
      page.getByText(/Guest Mode/i),
    ).toBeVisible({ timeout: 15000 });
  });
});
