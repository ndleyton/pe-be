import { test, expect, type Page } from "@playwright/test";
import { openWorkoutForm } from "./utils/workouts";

const gotoHome = async (page: Page) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(/\/workouts$/);
  await expect(page.locator("main")).toBeVisible();
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

const createGuestWorkout = async (page: Page) => {
  await page.goto("/workouts", { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL("/workouts");
  await openWorkoutForm(page);
  await page.getByTestId("open-workout-type-modal").click();
  await page.getByTestId("workout-type-strength-training").click();
  await page.getByTestId("start-workout-button").click();
  await expect(page).toHaveURL(/\/workouts\/.+/, { timeout: 10000 });
  return new URL(page.url()).pathname;
};

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
    const workoutPath = await createGuestWorkout(page);

    await clickDesktopNavLink(page, "Profile");
    await expect(page).toHaveURL("/profile");
    await expect(
      page.getByRole("heading", { name: "Profile", exact: true }),
    ).toBeVisible();

    const workoutsLink = desktopNavLink(page, "Workouts");
    await expect(workoutsLink).toHaveAttribute("href", workoutPath);
    await workoutsLink.click({ force: true });

    await expect(page).toHaveURL(workoutPath);
  });

  test("should persist last visited path within navigation sections", async ({
    page,
  }) => {
    const workoutPath = await createGuestWorkout(page);

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
    await expect(page).toHaveURL(workoutPath);
  });

  test("should persist navigation state across browser sessions", async ({
    page,
    context,
  }) => {
    const workoutPath = await createGuestWorkout(page);

    await page.close();
    const newPage = await context.newPage();
    await newPage.setViewportSize({ width: 1280, height: 720 });
    await newPage.goto(workoutPath, { waitUntil: "domcontentloaded" });
    await expect(newPage).toHaveURL(workoutPath);

    await clickDesktopNavLink(newPage, "Profile");
    await expect(newPage).toHaveURL("/profile");
    await expect(
      newPage.getByRole("heading", { name: "Profile", exact: true }),
    ).toBeVisible();

    const workoutsLink = desktopNavLink(newPage, "Workouts");
    await expect(workoutsLink).toHaveAttribute("href", workoutPath);
    await workoutsLink.click({ force: true });

    await expect(newPage).toHaveURL(workoutPath);
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
