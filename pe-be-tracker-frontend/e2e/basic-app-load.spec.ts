import { test, expect } from "@playwright/test";

test.describe("Basic App Loading", () => {
  test("should load the app successfully", async ({ page }) => {
    // Simulate a guest user
    await page.route("**/auth/session", (route) => {
      route.fulfill({
        status: 401,
        body: JSON.stringify({ detail: "Not authenticated" }),
      });
    });

    await page.goto("/");

    await expect(page).toHaveTitle(/PersonalBestie/);
    await expect(page.locator("#root")).not.toBeEmpty();
  });
});
