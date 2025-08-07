import { test, expect } from '@playwright/test';

// Helper function to dismiss common overlays that might interfere with clicks
async function dismissOverlays(page: any) {
  // Try to dismiss cookie consent banners
  try {
    const cookieButtons = page.locator('button:has-text("Accept"), button:has-text("Got it"), button:has-text("OK"), [data-testid*="cookie"], [data-testid*="consent"]');
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
    const overlayButtons = page.locator('button[aria-label*="close"], button[aria-label*="dismiss"], .close-button, .dismiss-button');
    const overlayButton = await overlayButtons.first();
    if (await overlayButton.isVisible()) {
      await overlayButton.click();
      await page.waitForTimeout(1000); // Wait for animation
    }
  } catch (error) {
    // Ignore if no overlay found
  }
}

test.describe('Guest Mode Workout Creation', () => {
  test('should allow a guest user to create a workout', async ({ page }) => {
    // Log all console messages and errors for debugging
    page.on('console', msg => console.log(`BROWSER LOG: ${msg.text()}`));
    page.on('pageerror', error => console.log(`PAGE ERROR: ${error.message}`));
    
    await page.goto('/');

    // Wait for the page to be fully loaded
    await page.waitForLoadState('networkidle');

    // 1. Click the "Try as Guest" button to enter the app
    await page.click('text=Try as Guest');
    await expect(page).toHaveURL('/workouts');

    // Dismiss any overlays that might interfere with the FAB
    await dismissOverlays(page);

    // 2. Click the floating action button to show the workout form
    const fab = page.locator('[data-testid="fab-add-workout"]');
    await fab.waitFor({ state: 'visible', timeout: 10000 });
    
    // Try to click with force if normal click fails due to overlay interference
    try {
      await fab.click({ timeout: 5000 });
    } catch (error) {
      // If normal click fails, try force click
      await fab.click({ force: true, timeout: 5000 });
    }

    // Add debugging to see what happens after FAB click
    await page.waitForTimeout(2000); // Give React time to update state
    
    // Take a screenshot after FAB click for debugging
    await page.screenshot({ path: 'test-results/after-fab-click.png' });
    
    // Log the page content to see if form is actually rendered
    const pageContent = await page.content();
    console.log('Page content after FAB click (length):', pageContent.length);
    
    // Try multiple selectors to find the form
    let formFound = false;
    
    // Option 1: Wait for the specific test ID that should appear when form shows
    try {
      await page.waitForSelector('[data-testid="workout-name-heading"]', { timeout: 10000 });
      formFound = true;
      console.log('Found form via workout-name-heading test ID');
    } catch (error) {
      console.log('workout-name-heading not found, trying form selector...');
    }
    
    // Option 2: If test ID didn't work, try form selector
    if (!formFound) {
      try {
        await page.waitForSelector('form', { timeout: 10000 });
        formFound = true;
        console.log('Found form via form selector');
      } catch (error) {
        console.log('form selector also failed');
      }
    }
    
    // Option 3: If neither worked, try waiting for any form-related content
    if (!formFound) {
      try {
        await page.waitForSelector('input[data-testid="workout-name-input"], button[data-testid="start-workout-button"]', { timeout: 5000 });
        formFound = true;
        console.log('Found form via input/button selectors');
      } catch (error) {
        console.log('No form elements found at all');
        // Take another screenshot for debugging
        await page.screenshot({ path: 'test-results/no-form-found.png' });
        throw new Error('Workout form did not appear after clicking FAB');
      }
    }
    
    // Wait for the workout name heading to be visible and click it
    // (This might already be visible from our checks above, but ensure it's clickable)
    await page.locator('[data-testid="workout-name-heading"]').waitFor({ state: 'visible', timeout: 5000 });
    await page.locator('[data-testid="workout-name-heading"]').click();

    // 4. Fill out the workout form
    const workoutName = `Test Workout ${Date.now()}`;
    await page.fill('[data-testid="workout-name-input"]', workoutName);

    await page.fill('[data-testid="workout-notes-input"]', 'E2E test notes');

    // 5. Open workout type modal and select a type
    await page.click('[data-testid="open-workout-type-modal"]');
    await expect(page.locator('div[role="dialog"], .fixed').filter({ hasText: 'Select Workout Type' })).toBeVisible();
    await page.click('text=Strength Training');

    // 6. Submit the form
    await page.click('[data-testid="start-workout-button"]');

    // 7. Verify the app navigates to the new workout's page
    await expect(page).toHaveURL(new RegExp('/workouts/.+'), { timeout: 10000 });
    await expect(page.locator(`h2:has-text("${workoutName}")`)).toBeVisible();
  });

  test.afterEach(async ({ page }) => {
    // Clean up guest data stored in localStorage so subsequent tests start fresh
    await page.evaluate(() => {
      localStorage.removeItem('pe-guest-data');
    });
  });
});
