import { test, expect } from "@playwright/test";
import { clearGuestData } from "./utils/storage";
import { openWorkoutForm, renameWorkout } from "./utils/workouts";

test.describe("Intensity Input", () => {
  test.beforeEach(async ({ page }) => {
    await clearGuestData(page);
  });

  test.afterEach(async ({ page }) => {
    await clearGuestData(page);
  });

  test("allows entering decimal intensity values without losing formatting", async ({
    page,
  }) => {
    await page.route("**/auth/session", (route) => {
      route.fulfill({
        status: 401,
        body: JSON.stringify({ detail: "Not authenticated" }),
      });
    });

    await page.goto("/workouts", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL("/workouts");
    await expect(page.getByRole("heading", {
      name: "Workouts",
      exact: true,
    })).toBeVisible();

    await openWorkoutForm(page);

    const workoutName = `Intensity E2E ${Date.now()}`;
    await renameWorkout(page, workoutName);
    await page
      .getByTestId("workout-notes-input")
      .fill("E2E intensity input test");

    await page.getByTestId("open-workout-type-modal").click();
    await page.getByTestId("workout-type-strength-training").click();

    await page.getByTestId("start-workout-button").click();

    await expect(page).toHaveURL(/\/workouts\//, { timeout: 10000 });
    await expect(
      page.getByRole("heading", { name: workoutName }),
    ).toBeVisible();

    // Open exercise modal and select exercise type
    await page.getByRole("button", { name: "Add Exercise" }).click();
    await expect(
      page.getByRole("heading", { name: "Select Exercise Type" }),
    ).toBeVisible();
    await page.getByPlaceholder("Search exercise types...").fill("Push");
    await page.getByRole("button", { name: /^P Push-ups\b/ }).click();

    const exerciseHeading = page.getByRole("heading", { name: "Push-ups" });
    await exerciseHeading.waitFor({ state: "visible" });

    await page.getByTestId("add-set-button").click();

    const intensityInput = page.getByTestId("intensity-input").first();
    await intensityInput.click();
    await page.keyboard.type("20.5");
    await page.keyboard.press("Enter");

    await expect(intensityInput).toHaveValue("20.5");
  });
});
