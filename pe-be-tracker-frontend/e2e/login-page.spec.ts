import { test, expect } from '@playwright/test';

test.describe('Guest Mode Landing', () => {
  test('should show workouts page for a guest user', async ({ page }) => {
    // Log all console messages from the browser to the terminal
    page.on('console', msg => console.log(`BROWSER LOG: ${msg.text()}`));
    page.on('pageerror', error => console.log(`PAGE ERROR: ${error.message}`));

    // Mock the /users/me API call to simulate a guest user
    await page.route('**/users/me', route => {
      route.fulfill({
        status: 401,
        body: JSON.stringify({ detail: 'Not authenticated' }),
      });
    });

    // Navigate to the app (redirects to /workouts)
    await page.goto('/workouts');

    // Wait for the page to be fully loaded
    await page.waitForLoadState('networkidle');

    // Wait for the workouts page heading
    await expect(page.getByRole('heading', { name: 'Workouts' })).toBeVisible({ timeout: 10000 });

    // Sanity: FAB should be present for adding a workout in guest mode
    await expect(page.getByTestId('fab-add-workout')).toBeVisible({ timeout: 10000 });

    // Guest banner appears after auth initializes and a display delay.
    // Wait explicitly to avoid flakiness across browsers.
    await page.waitForTimeout(1200);
    await expect(
      page.getByText('Guest Mode: Your workout data is stored locally', { exact: false })
    ).toBeVisible({ timeout: 5000 });
  });
});
