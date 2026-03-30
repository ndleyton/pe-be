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

test.describe("Header behavior", () => {
  test("shows the centered logo and menu on mobile", async ({ page }) => {
    await mockGuestUser(page);
    await page.setViewportSize({ width: 390, height: 844 });

    await page.goto("/workouts");
    await page.waitForLoadState("networkidle");

    const banner = page.getByRole("banner", { name: /primary navigation/i });
    const menuButton = banner.getByRole("button", {
      name: /open navigation menu/i,
    });
    const logoLink = banner.getByRole("link", { name: /go to workouts/i });

    await expect(menuButton).toBeVisible();
    await expect(logoLink).toBeVisible();

    const bannerBox = await banner.boundingBox();
    const logoBox = await logoLink.boundingBox();
    const menuBox = await menuButton.boundingBox();

    expect(bannerBox).not.toBeNull();
    expect(logoBox).not.toBeNull();
    expect(menuBox).not.toBeNull();

    const bannerCenter = bannerBox!.x + bannerBox!.width / 2;
    const logoCenter = logoBox!.x + logoBox!.width / 2;

    expect(Math.abs(logoCenter - bannerCenter)).toBeLessThan(40);
    expect(menuBox!.x).toBeLessThan(logoBox!.x);
  });

  test("shows the sidebar home link and page title on desktop", async ({
    page,
  }) => {
    await mockGuestUser(page);
    await page.setViewportSize({ width: 1280, height: 800 });

    await page.goto("/exercise-types");
    await page.waitForLoadState("networkidle");

    const banner = page.getByRole("banner", { name: /primary navigation/i });
    const sidebar = page.getByRole("complementary");

    await expect(sidebar.getByRole("link", { name: /go to workouts/i })).toBeVisible();
    await expect(
      banner.getByRole("heading", { name: /^exercises$/i }),
    ).toBeVisible();
    await expect(
      banner.getByRole("button", { name: /open navigation menu/i }),
    ).not.toBeVisible();
  });
});
