import { expect, test } from "@playwright/test";

const USER_ME_ROUTE = "**/api/v1/users/me";
const GOOGLE_AUTHORIZE_ROUTE = "**/api/v1/auth/google/authorize";
const WORKOUTS_MINE_ROUTE = "**/api/v1/workouts/mine**";
const POST_LOGIN_STORAGE_KEY = "auth:post-login-destination";

test.describe("Login Auth Intent", () => {
  test("starts Google sign-in from /login after stripping auth_intent", async ({
    page,
    baseURL,
  }) => {
    let authorizeCount = 0;
    let pageUrlAtAuthorizeRequest = "";
    let storedDestinationAtAuthorizeRequest: string | null = null;

    await page.route(USER_ME_ROUTE, async (route) => {
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ detail: "Not authenticated" }),
      });
    });

    await page.route(GOOGLE_AUTHORIZE_ROUTE, async (route) => {
      authorizeCount += 1;
      pageUrlAtAuthorizeRequest = page.url();
      storedDestinationAtAuthorizeRequest = await page.evaluate((key) => {
        return window.sessionStorage.getItem(key);
      }, POST_LOGIN_STORAGE_KEY);

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          authorization_url: "https://accounts.google.test/o/oauth2/v2/auth",
        }),
      });
    });

    await page.route("https://accounts.google.test/**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "text/html",
        body: "<html><body><h1>Google OAuth Mock</h1></body></html>",
      });
    });

    await page.goto("/login?auth_intent=google&next=/about&utm_source=landing");

    await expect(
      page.getByRole("heading", { name: "Google OAuth Mock" }),
    ).toBeVisible();

    expect(authorizeCount).toBe(1);
    expect(pageUrlAtAuthorizeRequest).toBe(`${baseURL}/login`);
    expect(storedDestinationAtAuthorizeRequest).toBe("/about");
  });

  test("redirects authenticated users to next without starting Google auth", async ({
    page,
  }) => {
    let authorizeCount = 0;

    await page.route(USER_ME_ROUTE, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: 1,
          email: "auth@example.com",
          name: "Auth User",
        }),
      });
    });

    await page.route(WORKOUTS_MINE_ROUTE, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: [], next_cursor: null }),
      });
    });

    await page.route(GOOGLE_AUTHORIZE_ROUTE, async (route) => {
      authorizeCount += 1;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          authorization_url: "https://accounts.google.test/o/oauth2/v2/auth",
        }),
      });
    });

    await page.goto("/login?auth_intent=google&next=/about");

    await page.waitForURL("**/about");
    await expect(
      page.getByRole("heading", { name: "About Me" }),
    ).toBeVisible();
    expect(authorizeCount).toBe(0);
  });
});
