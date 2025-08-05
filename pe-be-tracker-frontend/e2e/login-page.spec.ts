import { test, expect } from '@playwright/test';

test.describe('Login Page', () => {
  test('should render the login page correctly for a guest user', async ({ page }) => {
    // Mock the /users/me API call to simulate a guest user
    await page.route('**/users/me', route => {
      route.fulfill({
        status: 401,
        body: JSON.stringify({ detail: 'Not authenticated' }),
      });
    });

    // Navigate to the root of the app
    await page.goto('/');

    // Check that the main heading is visible
    await expect(page.locator('h1:has-text("Welcome to PersonalBestie")')).toBeVisible();

    // Check that the "Try as Guest" button is visible
    await expect(page.locator('button:has-text("Try as Guest")')).toBeVisible();
  });
});
