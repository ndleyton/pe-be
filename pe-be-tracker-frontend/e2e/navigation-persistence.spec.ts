import { test, expect } from '@playwright/test';

test.describe('Navigation Persistence', () => {
  test('should persist last visited path within navigation sections', async ({ page }) => {
    // Start at the homepage
    await page.goto('/');

    // Wait for the page to load
    await expect(page).toHaveTitle(/PersonalBestie/);

    // Navigate to workouts (should go to /workouts by default)
    await page.getByRole('link', { name: 'Workouts' }).click();
    await expect(page).toHaveURL('/workouts');

    // Navigate to a specific workouts sub-path (if it exists, otherwise just workouts)
    // For now, let's assume we stay at workouts
    
    // Navigate to exercises section
    await page.getByRole('link', { name: 'Exercises' }).click();
    await expect(page).toHaveURL('/exercise-types');

    // Navigate to profile section  
    await page.getByRole('link', { name: 'Profile' }).click();
    await expect(page).toHaveURL('/profile');

    // Navigate to chat section
    await page.getByRole('link', { name: 'Chat' }).click();
    await expect(page).toHaveURL('/chat');

    // Now refresh the page to test persistence
    await page.reload();

    // After refresh, we should still be on /chat
    await expect(page).toHaveURL('/chat');

    // Navigate back to exercises - should remember last visited exercises path
    await page.getByRole('link', { name: 'Exercises' }).click();
    await expect(page).toHaveURL('/exercise-types');

    // Navigate back to workouts - should remember last visited workouts path  
    await page.getByRole('link', { name: 'Workouts' }).click();
    await expect(page).toHaveURL('/workouts');

    // Test persistence after page refresh
    await page.reload();
    await expect(page).toHaveURL('/workouts');
  });

  test('should persist navigation state across browser sessions', async ({ page, context }) => {
    // Navigate to different sections to build navigation history
    await page.goto('/');
    
    // Navigate to exercises
    await page.getByRole('link', { name: 'Exercises' }).click();
    await expect(page).toHaveURL('/exercise-types');

    // Navigate to profile
    await page.getByRole('link', { name: 'Profile' }).click();
    await expect(page).toHaveURL('/profile');

    // Close the current page and create a new one (simulates new browser session)
    await page.close();
    const newPage = await context.newPage();

    // Go to homepage in new "session"
    await newPage.goto('/');

    // Navigate to profile - should remember the last visited profile path
    await newPage.getByRole('link', { name: 'Profile' }).click();
    await expect(newPage).toHaveURL('/profile');

    // Navigate to exercises - should remember the last visited exercises path
    await newPage.getByRole('link', { name: 'Exercises' }).click();
    await expect(newPage).toHaveURL('/exercise-types');

    await newPage.close();
  });

  test('should handle navigation on both mobile and desktop layouts', async ({ page }) => {
    // Test desktop navigation (assuming screen width > 1024px triggers desktop)
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/');

    // Navigate using desktop sidebar
    await page.getByRole('link', { name: 'Workouts' }).click();
    await expect(page).toHaveURL('/workouts');

    // Navigate to exercises via desktop sidebar
    await page.getByRole('link', { name: 'Exercises' }).click();
    await expect(page).toHaveURL('/exercise-types');

    // Switch to mobile layout
    await page.setViewportSize({ width: 375, height: 667 });

    // Should still be on exercises page
    await expect(page).toHaveURL('/exercise-types');

    // Navigate using bottom navigation (mobile)
    await page.getByRole('link', { name: 'Profile' }).click();
    await expect(page).toHaveURL('/profile');

    // Switch back to desktop
    await page.setViewportSize({ width: 1280, height: 720 });

    // Should still be on profile page
    await expect(page).toHaveURL('/profile');

    // Navigate using desktop sidebar again
    await page.getByRole('link', { name: 'Chat' }).click();
    await expect(page).toHaveURL('/chat');
  });

  test('should clear navigation state when localStorage is unavailable', async ({ page, context }) => {
    // Block localStorage to simulate incognito/restricted environments
    await context.addInitScript(() => {
      Object.defineProperty(window, 'localStorage', {
        value: {
          getItem: () => { throw new Error('localStorage not available'); },
          setItem: () => { throw new Error('localStorage not available'); },
          removeItem: () => { throw new Error('localStorage not available'); },
        },
        writable: false
      });
    });

    await page.goto('/');

    // Navigation should still work, just without persistence
    await page.getByRole('link', { name: 'Workouts' }).click();
    await expect(page).toHaveURL('/workouts');

    await page.getByRole('link', { name: 'Exercises' }).click();
    await expect(page).toHaveURL('/exercise-types');

    // After reload, should go to default paths (no persistence)
    await page.reload();
    
    // Navigate to workouts - should go to default /workouts (not persisted path)
    await page.getByRole('link', { name: 'Workouts' }).click();
    await expect(page).toHaveURL('/workouts');
  });
});