import { test, expect } from "@playwright/test";
import { clearGuestData } from "./utils/storage";
import { openWorkoutForm, renameWorkout } from "./utils/workouts";

async function dismissOverlays(page: any) {
  try {
    const cookieButtons = page.locator(
      'button:has-text("Accept"), button:has-text("Got it"), button:has-text("OK"), [data-testid*="cookie"], [data-testid*="consent"]',
    );
    const cookieButton = await cookieButtons.first();
    if (await cookieButton.isVisible()) {
      await cookieButton.click();
      await page.waitForTimeout(1000);
    }
  } catch {
    // Ignore if no cookie banner found
  }

  try {
    const overlayButtons = page.locator(
      'button[aria-label*="close"], button[aria-label*="dismiss"], .close-button, .dismiss-button',
    );
    const overlayButton = await overlayButtons.first();
    if (await overlayButton.isVisible()) {
      await overlayButton.click();
      await page.waitForTimeout(1000);
    }
  } catch {
    // Ignore if no overlay found
  }
}

test.describe("Finish workout routine creation", () => {
  test("does not offer routine creation from FinishWorkoutModal in guest mode", async ({
    page,
  }) => {
    await page.route("**/auth/session", (route) => {
      route.fulfill({
        status: 401,
        body: JSON.stringify({ detail: "Not authenticated" }),
      });
    });

    await page.goto("/workouts");
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveURL(/\/workouts$/);
    await expect(page.getByRole("heading", {
      name: "Workouts",
      exact: true,
    })).toBeVisible();

    await dismissOverlays(page);

    await openWorkoutForm(page);

    const workoutName = `Routine Source Workout ${Date.now()}`;
    await renameWorkout(page, workoutName);
    await page.getByTestId("workout-notes-input").fill("E2E routine notes");

    await page.getByTestId("open-workout-type-modal").click();
    await expect(
      page
        .locator('div[role="dialog"], .fixed')
        .filter({ hasText: "Select Workout Type" }),
    ).toBeVisible();
    await page.getByTestId("workout-type-strength-training").click();

    await page.getByTestId("start-workout-button").click();
    await expect(page).toHaveURL(new RegExp("/workouts/.+"), {
      timeout: 10000,
    });

    await page.getByRole("button", { name: "Add Exercise" }).click();
    await expect(
      page.getByRole("heading", { name: "Select Exercise Type" }),
    ).toBeVisible();
    await page.getByText("Push-ups", { exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Select Exercise Type" }),
    ).not.toBeVisible();
    await expect(page.getByText("Push-ups", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Floating action button" }).click();
    await expect(
      page.locator('[data-testid="finish-workout-modal"]'),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Save Routine" }),
    ).not.toBeVisible();
    await expect(page.getByRole("button", { name: "Finish Workout" })).toBeVisible();

    await page.getByRole("button", { name: "Finish Workout" }).click();
    await expect(page).toHaveURL(/\/workouts$/, { timeout: 10000 });
    await expect(page.getByRole("heading", {
      name: "Workouts",
      exact: true,
    })).toBeVisible();
  });

  test.afterEach(async ({ page }) => {
    await clearGuestData(page);
  });
});
