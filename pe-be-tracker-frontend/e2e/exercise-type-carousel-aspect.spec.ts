import { test, expect } from "@playwright/test";

test.describe("Exercise Type Carousel Aspect Ratio", () => {
  test("uses first image intrinsic aspect ratio for container", async ({
    page,
  }) => {
    // Use a deterministic exercise type id for routing
    const id = "12345";

    // Stub exercise type details with a known non-square first image (300x200 => 3:2)
    await page.route(`**/exercises/exercise-types/${id}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id,
          name: "E2E Aspect Exercise",
          description: null,
          muscle_groups: [],
          equipment: null,
          instructions: null,
          category: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          usage_count: 0,
          times_used: 0,
          default_intensity_unit: 1,
          images: ["/assets/test-300x200.svg", "/assets/icon-192.png"],
          muscles: [],
        }),
      });
    });

    // Stub stats endpoint
    await page.route(
      `**/exercises/exercise-types/${id}/stats`,
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            progressiveOverload: [],
            lastWorkout: null,
            personalBest: null,
            totalSets: 0,
            intensityUnit: { id: 1, name: "Kilograms", abbreviation: "kg" },
          }),
        });
      },
    );

    // Give a roomy viewport to avoid very small rounding errors
    await page.setViewportSize({ width: 1200, height: 900 });

    // Navigate directly to the details page
    await page.route("**/auth/session", (route) => {
      route.fulfill({
        status: 401,
        body: JSON.stringify({ detail: "Not authenticated" }),
      });
    });

    await page.goto(`/exercise-types/${id}`);

    const container = page.getByTestId("exercise-carousel-container");
    await expect(container).toBeVisible();

    // Wait until the first image has loaded and spinner is gone
    await expect(container.locator(".loading")).toHaveCount(0, {
      timeout: 15000,
    });
    // The carousel renders multiple <img> nodes; assert the first is visible
    await expect(container.locator("img").first()).toBeVisible();

    // Measure the rendered box and verify it approximates a 3:2 ratio
    const box = await container.boundingBox();
    expect(box).not.toBeNull();
    if (!box) return; // Type narrowing for TS
    const ratio = box.width / box.height;

    // 3:2 = 1.5; allow a small tolerance for layout rounding
    expect(Math.abs(ratio - 1.5)).toBeLessThan(0.1);
  });
});
