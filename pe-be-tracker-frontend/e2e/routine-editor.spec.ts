import { test, expect } from "@playwright/test";
import { clearGuestData, seedGuestData } from "./utils/storage";

const apiBase = "**/api/v1";

const exerciseTypesResponse = {
  data: [
    {
      id: 11,
      name: "Bench Press",
      description: "Chest press",
      default_intensity_unit: 3,
      times_used: 10,
      muscles: [],
      created_at: "2026-03-10T10:00:00.000Z",
      updated_at: "2026-03-10T10:00:00.000Z",
    },
    {
      id: 22,
      name: "Pull Up",
      description: "Vertical pull",
      default_intensity_unit: 1,
      times_used: 8,
      muscles: [],
      created_at: "2026-03-10T10:00:00.000Z",
      updated_at: "2026-03-10T10:00:00.000Z",
    },
  ],
  next_cursor: null,
};

const intensityUnitsResponse = [
  {
    id: 1,
    name: "Bodyweight",
    abbreviation: "bw",
    created_at: "2026-03-10T10:00:00.000Z",
    updated_at: "2026-03-10T10:00:00.000Z",
  },
  {
    id: 2,
    name: "Kilograms",
    abbreviation: "kg",
    created_at: "2026-03-10T10:00:00.000Z",
    updated_at: "2026-03-10T10:00:00.000Z",
  },
  {
    id: 3,
    name: "Pounds",
    abbreviation: "lbs",
    created_at: "2026-03-10T10:00:00.000Z",
    updated_at: "2026-03-10T10:00:00.000Z",
  },
];

test.describe("Routine editor", () => {
  test.afterEach(async ({ page }) => {
    await clearGuestData(page);
  });

  test("unauthenticated users without a local routine do not see the editor", async ({
    page,
  }) => {
    const guestAuthHandler = (route: any) => {
      route.fulfill({
        status: 401,
        body: JSON.stringify({ detail: "Not authenticated" }),
      });
    };

    await page.route("**/users/me", guestAuthHandler);
    await page.route(`${apiBase}/users/me`, guestAuthHandler);
    await page.route("**/api/v1/routines/123*", async (route) => {
      await route.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({ detail: "Routine not found" }),
      });
    });

    await page.goto("/routines/123");

    await expect(
      page.getByRole("alert").getByText("Routine unavailable"),
    ).toBeVisible();
    await expect(
      page.getByText(/it may have been deleted or you may not have access to it/i),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Routine Editor" }),
    ).toHaveCount(0);
    await expect(page.getByTestId("save-routine-button")).toHaveCount(0);
  });

  test("unauthenticated users can open an existing public routine but cannot edit it", async ({
    page,
  }) => {
    const guestAuthHandler = (route: any) => {
      route.fulfill({
        status: 401,
        body: JSON.stringify({ detail: "Not authenticated" }),
      });
    };
    const routineState = {
      id: 321,
      name: "Public Routine",
      description: "Visible to signed-out visitors",
      workout_type_id: 4,
      creator_id: 999,
      visibility: "public",
      is_readonly: false,
      created_at: "2026-03-10T10:00:00.000Z",
      updated_at: "2026-03-10T10:00:00.000Z",
      exercise_templates: [
        {
          id: 7001,
          exercise_type_id: 11,
          created_at: "2026-03-10T10:00:00.000Z",
          updated_at: "2026-03-10T10:00:00.000Z",
          exercise_type: {
            id: 11,
            name: "Bench Press",
            description: "Chest press",
            default_intensity_unit: 3,
            times_used: 10,
          },
          set_templates: [
            {
              id: 8001,
              reps: 8,
              intensity: 135,
              intensity_unit_id: 3,
              created_at: "2026-03-10T10:00:00.000Z",
              updated_at: "2026-03-10T10:00:00.000Z",
              intensity_unit: {
                id: 3,
                name: "Pounds",
                abbreviation: "lbs",
              },
            },
          ],
        },
      ],
    };

    await page.route("**/users/me", guestAuthHandler);
    await page.route(`${apiBase}/users/me`, guestAuthHandler);
    await page.route("**/api/v1/routines/321*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(routineState),
      });
    });

    await page.goto("/routines/321");

    await expect(
      page.getByRole("heading", { name: "Routine Details" }),
    ).toBeVisible();
    await expect(
      page.getByText("Sign in as the routine creator or a superuser to edit this routine."),
    ).toBeVisible();
    await expect(page.getByTestId("routine-name-input")).toHaveValue(
      "Public Routine",
    );
    await expect(page.getByTestId("routine-name-input")).not.toBeEditable();
    await expect(page.getByTestId("save-routine-button")).toHaveCount(0);
    await expect(page.getByTestId("delete-routine-button")).toHaveCount(0);
    await expect(page.getByTestId("add-routine-exercise-button")).toHaveCount(0);
    await expect(
      page.getByTestId("start-routine-workout-button"),
    ).toBeVisible();
  });

  test("authenticated users can save a full routine replacement payload", async ({
    page,
  }) => {
    let routineState = {
      id: 123,
      name: "Server Routine",
      description: "Before edit",
      workout_type_id: 4,
      creator_id: 10,
      visibility: "private",
      is_readonly: false,
      created_at: "2026-03-10T10:00:00.000Z",
      updated_at: "2026-03-10T10:00:00.000Z",
      exercise_templates: [
        {
          id: 1001,
          exercise_type_id: 11,
          created_at: "2026-03-10T10:00:00.000Z",
          updated_at: "2026-03-10T10:00:00.000Z",
          exercise_type: {
            id: 11,
            name: "Bench Press",
            description: "Chest press",
            default_intensity_unit: 3,
            times_used: 10,
          },
          set_templates: [
            {
              id: 2001,
              reps: 8,
              intensity: 135,
              intensity_unit_id: 3,
              created_at: "2026-03-10T10:00:00.000Z",
              updated_at: "2026-03-10T10:00:00.000Z",
              intensity_unit: {
                id: 3,
                name: "Pounds",
                abbreviation: "lbs",
              },
            },
          ],
        },
      ],
    };
    let capturedUpdatePayload: any = null;

    await page.route(`${apiBase}/users/me`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: 10,
          email: "e2e@example.com",
        }),
      });
    });
    await page.route(`${apiBase}/exercises/intensity-units/`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(intensityUnitsResponse),
      });
    });
    await page.route(`${apiBase}/exercises/exercise-types/**`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(exerciseTypesResponse),
      });
    });
    await page.route(`${apiBase}/routines/123`, async (route) => {
      const method = route.request().method();

      if (method === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(routineState),
        });
        return;
      }

      if (method === "PUT") {
        capturedUpdatePayload = route.request().postDataJSON();
        routineState = {
          ...routineState,
          ...capturedUpdatePayload,
          updated_at: "2026-03-10T11:00:00.000Z",
          exercise_templates: [
            {
              id: 3001,
              exercise_type_id: 22,
              created_at: "2026-03-10T11:00:00.000Z",
              updated_at: "2026-03-10T11:00:00.000Z",
              exercise_type: {
                id: 22,
                name: "Pull Up",
                description: "Vertical pull",
                default_intensity_unit: 1,
                times_used: 8,
              },
              set_templates: [
                {
                  id: 4001,
                  reps: 12,
                  intensity: null,
                  intensity_unit_id: 1,
                  created_at: "2026-03-10T11:00:00.000Z",
                  updated_at: "2026-03-10T11:00:00.000Z",
                  intensity_unit: {
                    id: 1,
                    name: "Bodyweight",
                    abbreviation: "bw",
                  },
                },
                {
                  id: 4002,
                  reps: 10,
                  intensity: null,
                  intensity_unit_id: 1,
                  created_at: "2026-03-10T11:00:00.000Z",
                  updated_at: "2026-03-10T11:00:00.000Z",
                  intensity_unit: {
                    id: 1,
                    name: "Bodyweight",
                    abbreviation: "bw",
                  },
                },
              ],
            },
          ],
        };

        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(routineState),
        });
      }
    });

    await page.goto("/routines/123");
    await expect(
      page.getByRole("heading", { name: "Routine Editor" }),
    ).toBeVisible();

    await page.getByTestId("routine-name-input").fill("Edited Server Routine");
    await page.getByTestId("remove-routine-template-0").click();
    await page.getByTestId("add-routine-exercise-button").click();
    await expect(
      page.getByRole("heading", { name: "Select Exercise Type" }),
    ).toBeVisible();
    await page.getByText("Pull Up", { exact: true }).click();

    await page.getByTestId("routine-set-reps-0-0").fill("12");
    await page.getByTestId("add-routine-set-0").click();
    await page.getByTestId("routine-set-reps-0-1").fill("10");

    await page.getByTestId("save-routine-button").click();

    await expect.poll(() => Boolean(capturedUpdatePayload)).toBe(true);
    expect(capturedUpdatePayload).toEqual({
      name: "Edited Server Routine",
      description: "Before edit",
      workout_type_id: 4,
      exercise_templates: [
        {
          exercise_type_id: 22,
          set_templates: [
            {
              reps: 12,
              intensity: null,
              intensity_unit_id: 1,
            },
            {
              reps: 10,
              intensity: null,
              intensity_unit_id: 1,
            },
          ],
        },
      ],
    });

    await expect(page.getByTestId("save-routine-button")).toBeDisabled();
    await expect(page.getByTestId("routine-name-input")).toHaveValue(
      "Edited Server Routine",
    );
  });

  test("authenticated non-owners can open an existing public routine but cannot edit it", async ({
    page,
  }) => {
    const routineState = {
      id: 456,
      name: "Shared Routine",
      description: "Visible but not editable",
      workout_type_id: 4,
      creator_id: 999,
      visibility: "public",
      is_readonly: false,
      created_at: "2026-03-10T10:00:00.000Z",
      updated_at: "2026-03-10T10:00:00.000Z",
      exercise_templates: [
        {
          id: 5001,
          exercise_type_id: 11,
          created_at: "2026-03-10T10:00:00.000Z",
          updated_at: "2026-03-10T10:00:00.000Z",
          exercise_type: {
            id: 11,
            name: "Bench Press",
            description: "Chest press",
            default_intensity_unit: 3,
            times_used: 10,
          },
          set_templates: [
            {
              id: 6001,
              reps: 8,
              intensity: 135,
              intensity_unit_id: 3,
              created_at: "2026-03-10T10:00:00.000Z",
              updated_at: "2026-03-10T10:00:00.000Z",
              intensity_unit: {
                id: 3,
                name: "Pounds",
                abbreviation: "lbs",
              },
            },
          ],
        },
      ],
    };

    await page.route(`${apiBase}/users/me`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: 10,
          email: "viewer@example.com",
        }),
      });
    });
    await page.route(`${apiBase}/exercises/intensity-units/`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(intensityUnitsResponse),
      });
    });
    await page.route(`${apiBase}/routines/456`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(routineState),
      });
    });

    await page.goto("/routines/456");

    await expect(
      page.getByRole("heading", { name: "Routine Details" }),
    ).toBeVisible();
    await expect(
      page.getByText("Only the routine creator or a superuser can edit this routine."),
    ).toBeVisible();
    await expect(page.getByTestId("routine-name-input")).toHaveValue(
      "Shared Routine",
    );
    await expect(page.getByTestId("routine-name-input")).not.toBeEditable();
    await expect(page.getByTestId("save-routine-button")).toHaveCount(0);
    await expect(page.getByTestId("delete-routine-button")).toHaveCount(0);
    await expect(page.getByTestId("add-routine-exercise-button")).toHaveCount(0);
    await expect(
      page.getByTestId("start-routine-workout-button"),
    ).toBeVisible();
  });

  test("guest users start workouts from the current editor state, not stale routine data", async ({
    page,
  }) => {
    const guestAuthHandler = (route: any) => {
      route.fulfill({
        status: 401,
        body: JSON.stringify({ detail: "Not authenticated" }),
      });
    };
    await page.route("**/users/me", guestAuthHandler);
    await page.route(`${apiBase}/users/me`, guestAuthHandler);

    await page.goto("/workouts");
    await page.waitForURL(/\/workouts$/);

    await seedGuestData(page, {
      workouts: [],
      exerciseTypes: [
        {
          id: "1",
          name: "Push-ups",
          description: null,
          default_intensity_unit: 1,
          times_used: 0,
        },
        {
          id: "2",
          name: "Squat",
          description: null,
          default_intensity_unit: 2,
          times_used: 0,
        },
      ],
      workoutTypes: [
        { id: "8", name: "Other", description: "General workout session" },
      ],
      routines: [
        {
          id: "routine-1",
          name: "Starter Routine",
          exercises: [
            {
              id: "ex-1",
              exercise_type_id: "1",
              exercise_type: {
                id: "1",
                name: "Push-ups",
                description: "",
                default_intensity_unit: 1,
                times_used: 0,
              },
              sets: [
                {
                  id: "set-1",
                  reps: 10,
                  intensity: null,
                  intensity_unit_id: 1,
                  rest_time_seconds: null,
                },
              ],
              notes: null,
            },
          ],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ],
    });

    await page.reload();
    await page.goto("/routines/routine-1");
    await expect(
      page.getByRole("heading", { name: "Routine Editor" }),
    ).toBeVisible();

    await page.getByTestId("routine-name-input").fill("Edited Guest Routine");
    await page.getByTestId("add-routine-exercise-button").click();
    await expect(
      page.getByRole("heading", { name: "Select Exercise Type" }),
    ).toBeVisible();
    await page.getByText("Squat", { exact: true }).click();
    await page.getByTestId("routine-set-reps-1-0").fill("5");

    await page.getByTestId("start-routine-workout-button").click();

    await expect(page).toHaveURL(/\/workouts\/.+$/);
    await expect(
      page.getByRole("heading", { name: /Edited Guest Routine/i, level: 2 }),
    ).toBeVisible();
    await expect(page.getByText("Push-ups", { exact: true })).toBeVisible();
    await expect(page.getByText("Squat", { exact: true })).toBeVisible();
  });
});
