import { expect, test, type Page } from "@playwright/test";

const mockGuestUser = async (page: Page) => {
  await page.route("**/users/me", async (route) => {
    await route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({ detail: "Not authenticated" }),
    });
  });
};

test.describe("404 recovery", () => {
  test("shows recovery links and returns to workouts", async ({ page }) => {
    await mockGuestUser(page);

    await page.goto("/route-that-does-not-exist");
    await page.waitForLoadState("networkidle");

    const mainContent = page.locator("#main-content");

    await expect(
      mainContent.getByRole("heading", { name: /page not found/i }),
    ).toBeVisible();

    await expect(
      mainContent.getByRole("link", { name: /go to workouts/i }),
    ).toHaveAttribute("href", "/workouts");
    await expect(
      mainContent.getByRole("link", { name: /^workouts$/i }),
    ).toHaveAttribute("href", "/workouts");
    await expect(
      mainContent.getByRole("link", { name: /^exercises$/i }),
    ).toHaveAttribute("href", "/exercise-types");
    await expect(
      mainContent.getByRole("link", { name: /ai chat/i }),
    ).toHaveAttribute("href", "/chat");

    await mainContent.getByRole("link", { name: /go to workouts/i }).click();
    await expect(page).toHaveURL(/\/workouts$/);
    await expect(
      page.locator("#main-content").getByRole("heading", { name: /workouts/i }),
    ).toBeVisible();
  });

  test("falls back to workouts when there is no in-app history entry", async ({
    page,
  }) => {
    await mockGuestUser(page);

    await page.goto("/totally-missing");
    await page.waitForLoadState("networkidle");

    await page.getByRole("button", { name: /go back/i }).click();

    await expect(page).toHaveURL(/\/workouts$/);
  });
});
