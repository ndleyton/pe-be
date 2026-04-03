import { test, expect } from "@playwright/test";
import { clearGuestData } from "./utils/storage";

// Helper function to dismiss common overlays that might interfere with clicks
async function dismissOverlays(page: any) {
  // Try to dismiss cookie consent banners
  try {
    const cookieButtons = page.locator(
      'button:has-text("Accept"), button:has-text("Got it"), button:has-text("OK"), [data-testid*="cookie"], [data-testid*="consent"]',
    );
    const cookieButton = await cookieButtons.first();
    if (await cookieButton.isVisible()) {
      await cookieButton.click();
      await page.waitForTimeout(1000); // Wait for animation
    }
  } catch (error) {
    // Ignore if no cookie banner found
  }

  // Try to dismiss chat widgets or other overlays
  try {
    const overlayButtons = page.locator(
      'button[aria-label*="close"], button[aria-label*="dismiss"], .close-button, .dismiss-button',
    );
    const overlayButton = await overlayButtons.first();
    if (await overlayButton.isVisible()) {
      await overlayButton.click();
      await page.waitForTimeout(1000); // Wait for animation
    }
  } catch (error) {
    // Ignore if no overlay found
  }
}

test.describe("Guest Mode Workout Creation", () => {
  test("should allow a guest user to create a workout", async ({ page }) => {
    // Enhanced error logging to catch React loading issues
    const jsErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        console.log(`BROWSER ERROR: ${msg.text()}`);
        jsErrors.push(msg.text());
      } else {
        console.log(`BROWSER LOG: ${msg.text()}`);
      }
    });
    page.on("pageerror", (error) => {
      console.log(`PAGE ERROR: ${error.message}`);
      console.log(`PAGE ERROR STACK: ${error.stack}`);
      jsErrors.push(`PAGE ERROR: ${error.message}`);
    });
    page.on("requestfailed", (request) => {
      const failure = request.failure();
      if (failure) {
        console.log(
          `REQUEST FAILED: ${request.method()} ${request.url()} - ${failure.errorText}`,
        );
        jsErrors.push(
          `REQUEST FAILED: ${request.url()} - ${failure.errorText}`,
        );
      }
    });
    // Go directly to workouts; '/' redirects there now
    await page.route("**/auth/session", (route) => {
      route.fulfill({
        status: 401,
        body: JSON.stringify({ detail: "Not authenticated" }),
      });
    });

    await page.goto("/workouts");

    // Wait for the page to be fully loaded
    await page.waitForLoadState("networkidle");

    // Verify we are on workouts page
    await expect(page).toHaveURL(/\/workouts$/, { timeout: 10000 });
    await expect(page.getByRole("heading", {
      name: "Workouts",
      exact: true,
    })).toBeVisible();

    // Dismiss any overlays that might interfere with primary actions
    await dismissOverlays(page);

    // 2. Use the floating action button to show the workout form
    await page.getByTestId("fab-add-workout").click();

    // Wait for the workout form to appear
    await page
      .locator('[data-testid="workout-name-heading"]')
      .waitFor({ state: "visible", timeout: 10000 });
    await page.locator('[data-testid="workout-name-heading"]').click();

    // 4. Fill out the workout form
    const workoutName = `Test Workout ${Date.now()}`;
    await page.fill('[data-testid="workout-name-input"]', workoutName);

    await page.fill('[data-testid="workout-notes-input"]', "E2E test notes");

    // 5. Open workout type modal and select a type
    await page.click('[data-testid="open-workout-type-modal"]');
    await expect(
      page
        .locator('div[role="dialog"], .fixed')
        .filter({ hasText: "Select Workout Type" }),
    ).toBeVisible();
    await page.getByTestId("workout-type-strength-training").click();

    // 6. Submit the form
    await page.click('[data-testid="start-workout-button"]');

    // 7. Verify the app navigates to the new workout's page
    await expect(page).toHaveURL(new RegExp("/workouts/.+"), {
      timeout: 10000,
    });
    await expect(page.locator(`h2:has-text("${workoutName}")`)).toBeVisible();
  });

  test.afterEach(async ({ page }) => {
    await clearGuestData(page);
  });
});
