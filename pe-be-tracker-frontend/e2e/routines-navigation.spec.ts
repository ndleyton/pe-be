import { test, expect } from "@playwright/test";

test.describe("Routines quick-start navigation", () => {
  test("clicking More in RoutinesSection navigates to /routines", async ({
    page,
  }) => {
    const guestAuthHandler = (route: any) => {
      route.fulfill({
        status: 401,
        body: JSON.stringify({ detail: "Not authenticated" }),
      });
    };
    await page.route("**/auth/session", guestAuthHandler);
    await page.route("**/api/v1/auth/session", guestAuthHandler);

    await page.route("**/api/v1/routines/**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            id: 1,
            name: "Server Routine",
            description: "Sample",
            workout_type_id: 1,
            creator_id: 1,
            visibility: "public",
            is_readonly: false,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            exercise_count: 3,
            set_count: 9,
            exercise_names_preview: ["Push-ups", "Rows", "Squats"],
          },
        ]),
      });
    });

    await page.goto("/workouts");
    await page.waitForURL(/\/workouts$/);
    await page.getByTestId("fab-add-workout").waitFor({ state: "visible" });
    await expect(page.getByTestId("week-tracking")).toBeVisible();
    await expect(page.getByText("Server Routine")).toBeVisible();

    const moreLink = page.getByRole("link", { name: "Browse all routines" });
    await expect(moreLink).toBeVisible({ timeout: 10000 });
    await moreLink.click();

    await expect(page).toHaveURL(/\/routines$/);

    await expect(
      page.getByRole("heading", { name: "Routines", level: 1 }),
    ).toBeVisible();
  });
});
