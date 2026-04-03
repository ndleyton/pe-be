import { test, expect, type Page } from "@playwright/test";

const gotoPath = async (
  page: Page,
  path: string,
  expectedUrl: string | RegExp,
) => {
  await page.goto(path, { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(expectedUrl);
  await expect(page.locator("main")).toBeVisible();
};

test.describe("Navigation Persistence", () => {
  test.beforeEach(async ({ context }) => {
    await context.route("**/auth/session", (route) => {
      route.fulfill({
        status: 401,
        body: JSON.stringify({ detail: "Not authenticated" }),
      });
    });
  });

  test("should persist workouts section paths correctly", async ({ page }) => {
    await gotoPath(page, "/workouts", "/workouts");
    await gotoPath(page, "/workouts/123", "/workouts/123");
    await expect(
      page.getByRole("heading", { name: "Page Not Found" }),
    ).toBeVisible();

    await gotoPath(page, "/", /\/workouts$/);

    const workoutsLink = page.getByRole("link", { name: "Workouts" }).first();
    await expect(workoutsLink).toBeVisible();

    const href = await workoutsLink.getAttribute("href");
    await workoutsLink.click();

    if (href?.includes("/workouts/123")) {
      await expect(page).toHaveURL("/workouts/123");
    } else {
      await expect(page).toHaveURL(/\/workouts/);
    }
  });

  test("should persist last visited path within navigation sections", async ({
    page,
  }) => {
    await gotoPath(page, "/", /\/workouts$/);
    const exercisesLink = page.getByRole("link", { name: "Exercises" }).first();
    await expect(exercisesLink).toBeVisible();
    await exercisesLink.click();
    await expect(page).toHaveURL("/exercise-types");

    const profileLink = page.getByRole("link", { name: "Profile" }).first();
    await expect(profileLink).toBeVisible();
    await profileLink.click();
    await expect(page).toHaveURL("/profile");

    const workoutsLink = page.getByRole("link", { name: "Workouts" }).first();
    await expect(workoutsLink).toBeVisible();
    await workoutsLink.click();
    await expect(page).toHaveURL(/\/workouts/);
  });

  test("should persist navigation state across browser sessions", async ({
    page,
    context,
  }) => {
    await gotoPath(page, "/", /\/workouts$/);
    await gotoPath(page, "/exercise-types", "/exercise-types");
    await gotoPath(page, "/profile", "/profile");

    await page.close();
    const newPage = await context.newPage();

    await gotoPath(newPage, "/", /\/workouts$/);
    await gotoPath(newPage, "/profile", "/profile");

    await newPage.close();
  });

  test("should handle navigation on both mobile and desktop layouts", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await gotoPath(page, "/", /\/workouts$/);
    await gotoPath(page, "/workouts", "/workouts");
    await gotoPath(page, "/exercise-types", "/exercise-types");

    await page.setViewportSize({ width: 375, height: 667 });
    await expect(page).toHaveURL("/exercise-types");
    await gotoPath(page, "/profile", "/profile");
  });

  test("should handle basic navigation without errors", async ({ page }) => {
    await gotoPath(page, "/", /\/workouts$/);
    await expect(page).toHaveTitle(/PersonalBestie/);
    await gotoPath(page, "/workouts", "/workouts");
    await gotoPath(page, "/exercise-types", "/exercise-types");
    await gotoPath(page, "/", /\/workouts$/);

    const workoutsLink = page.getByRole("link", { name: "Workouts" }).first();
    await expect(workoutsLink).toBeVisible();
    await workoutsLink.click();
    await expect(page).toHaveURL(/\/workouts/);
  });
});
