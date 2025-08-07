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
    // Enhanced error logging to catch React loading issues
    const jsErrors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log(`BROWSER ERROR: ${msg.text()}`);
        jsErrors.push(msg.text());
      } else {
        console.log(`BROWSER LOG: ${msg.text()}`);
      }
    });
    page.on('pageerror', error => {
      console.log(`PAGE ERROR: ${error.message}`);
      console.log(`PAGE ERROR STACK: ${error.stack}`);
      jsErrors.push(`PAGE ERROR: ${error.message}`);
    });
    page.on('requestfailed', request => {
      const failure = request.failure();
      if (failure) {
        console.log(`REQUEST FAILED: ${request.method()} ${request.url()} - ${failure.errorText}`);
        jsErrors.push(`REQUEST FAILED: ${request.url()} - ${failure.errorText}`);
      }
    });
    
    await page.goto('/');

    // Wait for the page to be fully loaded
    await page.waitForLoadState('networkidle');
    
    // Check if React loaded properly
    const reactStatus = await page.evaluate(() => {
      return {
        hasReact: typeof (window as any).React !== 'undefined',
        reactVersion: (window as any).React?.version || 'not found',
        hasReactDOM: typeof (window as any).ReactDOM !== 'undefined',
        rootElement: !!document.getElementById('root'),
        rootHasChildren: document.getElementById('root')?.children.length || 0,
        scripts: Array.from(document.scripts).map(s => ({
          src: s.src,
          loaded: !s.src || (s as any).readyState === 'complete' || (s as any).readyState === 'loaded'
        })),
        errorCount: (window as any).jsErrors?.length || 0
      };
    });
    console.log('React initialization status:', JSON.stringify(reactStatus, null, 2));
    
    // Report any JavaScript errors that might prevent React from loading
    if (jsErrors.length > 0) {
      console.log('JavaScript errors detected during page load:', jsErrors);
    }
    
    // Wait for the React app to be interactive - check for actual React content
    console.log('Waiting for React app to be interactive...');
    let reactReady = false;
    for (let i = 0; i < 15; i++) {
      const appStatus = await page.evaluate(() => {
        // Check multiple signs that React has loaded
        const rootEl = document.getElementById('root');
        const hasContent = rootEl && rootEl.children.length > 0;
        const hasReactFiber = rootEl && Object.keys(rootEl).some(key => key.startsWith('__reactFiber') || key.startsWith('_reactInternalInstance'));
        const hasEventListeners = rootEl && Object.keys(rootEl).some(key => key.startsWith('__reactEventHandlers'));
        
        return {
          hasWindow: typeof window !== 'undefined',
          hasRoot: !!rootEl,
          hasContent: hasContent,
          hasReactFiber: hasReactFiber,
          hasEventHandlers: hasEventListeners,
          rootInnerHTML: rootEl?.innerHTML?.length || 0,
          // Check for specific elements that should be rendered
          hasTryGuestButton: document.body.textContent?.includes('Try as Guest') ?? false,
          hasPersonalBestie: document.body.textContent?.includes('PersonalBestie') ?? false
        };
      });
      
      console.log(`App status check ${i + 1}:`, JSON.stringify(appStatus, null, 2));
      
      // Consider React ready if we have content and the specific elements we need
      if (appStatus.hasContent && appStatus.hasTryGuestButton) {
        console.log(`React app ready after ${i * 1000}ms`);
        reactReady = true;
        break;
      }
      await page.waitForTimeout(1000);
    }
    
    if (!reactReady) {
      console.log('React app never became interactive');
      const finalContent = await page.content();
      console.log('Final page HTML length:', finalContent.length);
      console.log('Body text:', await page.evaluate(() => document.body.textContent?.slice(0, 500) ?? 'No body text'));
      throw new Error('React app failed to become interactive - tests will fail');
    }

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
    
    let formElement: any = null;
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
        hasReact: typeof (window as any).React !== 'undefined',
        reactVersion: (window as any).React?.version || 'not found'
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
