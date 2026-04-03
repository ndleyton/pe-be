import { test, expect, type Page } from "@playwright/test";

const gotoHome = async (page: Page) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(/\/workouts$/);
  await expect(page.locator("main")).toBeVisible();
};

const gotoWorkoutPath = async (page: Page, workoutPath: string) => {
  await page.goto(workoutPath, { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(workoutPath);
};

const desktopNav = (page: Page) =>
  page.getByRole("navigation", { name: "Sidebar navigation" });

const desktopNavLink = (page: Page, name: string) =>
  desktopNav(page).getByRole("link", { name, exact: true });

const clickDesktopNavLink = async (page: Page, name: string) => {
  const link = desktopNavLink(page, name);
  await expect(link).toBeVisible();
  await link.click({ force: true });
};

const openMobileMenu = async (page: Page) => {
  const menuButton = page.getByRole("button", { name: "Open navigation menu" });
  await expect(menuButton).toBeVisible();
  await menuButton.click();
  await expect(page.getByRole("dialog")).toBeVisible();
};

const mobileNavLink = (page: Page, name: string) =>
  page
    .getByRole("navigation", { name: "Secondary navigation" })
    .getByRole("link", { name, exact: true });

test.describe("Navigation Persistence", () => {
  test.beforeEach(async ({ context, page }) => {
    await context.route("**/auth/session", (route) => {
      route.fulfill({
        status: 401,
        body: JSON.stringify({ detail: "Not authenticated" }),
      });
    });

    await page.setViewportSize({ width: 1280, height: 720 });
  });

  test("should persist workouts section paths correctly", async ({ page }) => {
    await gotoWorkoutPath(page, "/workouts/123");
    await expect(desktopNavLink(page, "Workouts")).toHaveAttribute(
      "href",
      "/workouts/123",
    );

    await gotoHome(page);

    const workoutsLink = desktopNavLink(page, "Workouts");
    await expect(workoutsLink).toHaveAttribute("href", "/workouts/123");
    await workoutsLink.click({ force: true });

    await expect(page).toHaveURL("/workouts/123");
  });

  test("should persist last visited path within navigation sections", async ({
    page,
  }) => {
    await gotoWorkoutPath(page, "/workouts/123");
    await expect(desktopNavLink(page, "Workouts")).toHaveAttribute(
      "href",
      "/workouts/123",
    );

    await gotoHome(page);

    await clickDesktopNavLink(page, "Exercises");
    await expect(page).toHaveURL("/exercise-types");
    await expect(
      page.getByRole("heading", { name: "Exercises", exact: true }),
    ).toBeVisible();

    await clickDesktopNavLink(page, "Profile");
    await expect(page).toHaveURL("/profile");
    await expect(
      page.getByRole("heading", { name: "Profile", exact: true }),
    ).toBeVisible();

    await clickDesktopNavLink(page, "Workouts");
    await expect(page).toHaveURL("/workouts/123");
  });

  test("should persist navigation state across browser sessions", async ({
    page,
    context,
  }) => {
    await gotoWorkoutPath(page, "/workouts/123");
    await expect(desktopNavLink(page, "Workouts")).toHaveAttribute(
      "href",
      "/workouts/123",
    );

    await page.close();
    const newPage = await context.newPage();
    await newPage.setViewportSize({ width: 1280, height: 720 });

    await gotoHome(newPage);

    const workoutsLink = desktopNavLink(newPage, "Workouts");
    await expect(workoutsLink).toHaveAttribute("href", "/workouts/123");
    await workoutsLink.click({ force: true });

    await expect(newPage).toHaveURL("/workouts/123");
  });

  test("should handle navigation on both mobile and desktop layouts", async ({
    page,
  }) => {
    await gotoHome(page);

    await clickDesktopNavLink(page, "Exercises");
    await expect(page).toHaveURL("/exercise-types");
    await expect(
      page.getByRole("heading", { name: "Exercises", exact: true }),
    ).toBeVisible();

    await page.setViewportSize({ width: 375, height: 667 });
    await openMobileMenu(page);
    await mobileNavLink(page, "Profile").click();

    await expect(page).toHaveURL("/profile");
    await expect(
      page.getByRole("heading", { name: "Profile", exact: true }),
    ).toBeVisible();
  });

  test("should handle basic navigation without errors", async ({ page }) => {
    await gotoHome(page);
    await expect(page).toHaveTitle(/PersonalBestie/);

    await clickDesktopNavLink(page, "Exercises");
    await expect(page).toHaveURL("/exercise-types");

    await clickDesktopNavLink(page, "Profile");
    await expect(page).toHaveURL("/profile");

    await clickDesktopNavLink(page, "Workouts");
    await expect(page).toHaveURL("/workouts");
    await expect(
      page.getByRole("heading", { name: "Workouts", exact: true }),
    ).toBeVisible();
  });
});
