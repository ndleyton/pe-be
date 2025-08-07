import { test, expect } from '@playwright/test';

test.describe('Login Page', () => {
  test('should render the login page correctly for a guest user', async ({ page }) => {
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

    // Navigate to the root of the app
    await page.goto('/');

    // Wait for the page to be fully loaded
    await page.waitForLoadState('networkidle');

    // Wait for the root element to be present
    await page.waitForSelector('#root', { timeout: 10000 });

    // Check that the main heading is visible
    await expect(page.locator('h1:has-text("Welcome to PersonalBestie")')).toBeVisible({ timeout: 10000 });

    // Check that the "Try as Guest" button is visible
    await expect(page.locator('button:has-text("Try as Guest")')).toBeVisible({ timeout: 10000 });
  });
});
