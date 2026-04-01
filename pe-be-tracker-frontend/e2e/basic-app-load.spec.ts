import { test, expect } from "@playwright/test";

test.describe("Basic App Loading", () => {
  test("should load the app successfully", async ({ page }) => {
    // Log all console messages and errors for debugging
    page.on("console", (msg) => console.log(`BROWSER LOG: ${msg.text()}`));
    page.on("pageerror", (error) =>
      console.log(`PAGE ERROR: ${error.message}`),
    );

    // Mock the /auth/session API call to simulate a guest user and reduce noise
    await page.route("**/auth/session", (route) => {
      route.fulfill({
        status: 401,
        body: JSON.stringify({ detail: "Not authenticated" }),
      });
    });

    // Navigate to the root of the app
    await page.goto("/");

    // Wait for the page to be fully loaded
    await page.waitForLoadState("networkidle");

    // Check that the root element exists
    await expect(page.locator("#root")).toBeVisible();

    // Check that some basic content is present
    await expect(page.locator("body")).not.toBeEmpty();

    // Take a screenshot for debugging
    await page.screenshot({ path: "test-results/app-load-screenshot.png" });

    // Log the page title
    const title = await page.title();
    console.log(`Page title: ${title}`);

    // Log the page content for debugging
    const content = await page.content();
    console.log(`Page content length: ${content.length}`);
  });
});
