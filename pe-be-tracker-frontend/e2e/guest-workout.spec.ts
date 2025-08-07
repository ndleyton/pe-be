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
    
    // Add comprehensive debugging for CI
    console.log('About to click FAB button');
    
    // Check page state before FAB click
    const beforeFabClick = await page.evaluate(() => ({
      url: window.location.href,
      bodyContent: document.body.innerText.slice(0, 300),
      hasShowWorkoutForm: document.body.innerHTML.includes('showWorkoutForm'),
      fabExists: !!document.querySelector('[data-testid="fab-add-workout"]'),
      formExists: !!document.querySelector('form'),
      headingExists: !!document.querySelector('[data-testid="workout-name-heading"]')
    }));
    console.log('Before FAB click state:', JSON.stringify(beforeFabClick, null, 2));

    // Try to click with force if normal click fails due to overlay interference
    try {
      await fab.click({ timeout: 5000 });
      console.log('FAB click successful (normal click)');
    } catch (error) {
      console.log('Normal FAB click failed:', error.message);
      // If normal click fails, try force click
      await fab.click({ force: true, timeout: 5000 });
      console.log('FAB click successful (force click)');
    }

    // Wait a moment for React to update
    await page.waitForTimeout(2000);

    // Check what happened after FAB click
    const afterFabClick = await page.evaluate(() => ({
      url: window.location.href,
      bodyContent: document.body.innerText.slice(0, 500),
      hasShowWorkoutForm: document.body.innerHTML.includes('showWorkoutForm'),
      fabExists: !!document.querySelector('[data-testid="fab-add-workout"]'),
      formExists: !!document.querySelector('form'),
      headingExists: !!document.querySelector('[data-testid="workout-name-heading"]'),
      allTestIds: Array.from(document.querySelectorAll('[data-testid]')).map(el => el.getAttribute('data-testid'))
    }));
    console.log('After FAB click state:', JSON.stringify(afterFabClick, null, 2));

    // Take screenshots for debugging
    await page.screenshot({ path: 'test-results/debug-before-form-wait.png', fullPage: true });

    // Try multiple selectors as fallback
    const selectors = [
      '[data-testid="workout-name-heading"]',
      'form h2',
      'form [role="heading"]',
      '[data-testid="start-workout-button"]'
    ];
    
    let formElement = null;
    for (const selector of selectors) {
      try {
        const element = page.locator(selector);
        const isVisible = await element.isVisible();
        console.log(`Selector "${selector}" visible: ${isVisible}`);
        if (isVisible) {
          formElement = element;
          console.log(`Found form using selector: ${selector}`);
          break;
        }
      } catch (error) {
        console.log(`Selector "${selector}" failed: ${error.message}`);
      }
    }

    if (!formElement) {
      // Final debugging before failure
      const finalState = await page.evaluate(() => ({
        fullHTML: document.documentElement.innerHTML.length,
        hasReact: typeof window.React !== 'undefined',
        reactVersion: window.React?.version || 'not found'
      }));
      console.log('Final debugging state:', JSON.stringify(finalState, null, 2));
      
      await page.screenshot({ path: 'test-results/form-never-appeared-final.png', fullPage: true });
      throw new Error('Workout form never appeared after clicking FAB. Check screenshots and logs above.');
    }

    // Wait for the workout form to appear and click the heading to edit name
    await page.locator('[data-testid="workout-name-heading"]').waitFor({ state: 'visible', timeout: 10000 });
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
