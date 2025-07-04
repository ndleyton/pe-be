import { test, expect } from '@playwright/test';

test.describe('Guest Mode Workout Creation', () => {
  test('should allow a guest user to create a workout', async ({ page }) => {
    await page.goto('/dashboard');

    // 1. Navigate to the workouts page
    await page.click('text=Workouts');
    await expect(page).toHaveURL('/workouts');

    // 2. Click the floating action button to show the workout form
    await page.click('button:has-text("+")');

    // 3. Click to edit the workout name
    await page.locator('form').getByRole('heading', { level: 2 }).click();

    // 4. Fill out the workout form
    const workoutName = `Test Workout ${Date.now()}`;
    await page.fill('input[name="name"]', workoutName);

    await page.fill('input[placeholder="How am I feeling today?"]', 'E2E test notes');

    // 5. Open workout type modal and select a type
    await page.click('button:has-text("Select Workout Type")');
    await expect(page.locator('div[role="dialog"], .fixed').filter({ hasText: 'Select Workout Type' })).toBeVisible();
    await page.click('text=Strength Training');

    // 6. Submit the form
    await page.click('button:has-text("Start Workout")');

    // 7. Verify the new workout appears on the workout page
    await expect(page.locator(`h3:has-text("${workoutName}")`)).toBeVisible();
  });
});
