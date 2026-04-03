import { expect, type Page } from "@playwright/test";

export async function openWorkoutForm(page: Page) {
  const createWorkoutFab = page.getByTestId("fab-add-workout");
  await expect(createWorkoutFab).toBeVisible();
  await createWorkoutFab.click();

  const workoutDialog = page.getByRole("dialog", {
    name: /Start Workout|Start from Routine/,
  });
  await expect(workoutDialog).toBeVisible();

  const workoutNameHeading = page.getByTestId("workout-name-heading");
  await expect(workoutNameHeading).toBeVisible();
}

export async function renameWorkout(page: Page, workoutName: string) {
  const workoutNameHeading = page.getByTestId("workout-name-heading");
  await workoutNameHeading.click({ force: true });

  const workoutNameInput = page.getByTestId("workout-name-input");
  await expect(workoutNameInput).toBeVisible();
  await workoutNameInput.fill(workoutName);
}
