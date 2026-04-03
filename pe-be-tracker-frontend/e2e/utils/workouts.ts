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
  const workoutNameEditor = workoutNameHeading.locator("xpath=..");
  await expect(workoutNameEditor).toBeVisible();
  await workoutNameEditor.scrollIntoViewIfNeeded();
  await workoutNameEditor.click({ force: true });

  const workoutNameInput = page.getByTestId("workout-name-input");
  await expect(workoutNameInput).toBeVisible();
  await workoutNameInput.fill(workoutName);

  const saveWorkoutNameButton = page.getByRole("button", {
    name: "save workout name",
  });
  await expect(saveWorkoutNameButton).toBeVisible();
  await saveWorkoutNameButton.click();
  await expect(workoutNameHeading).toHaveText(workoutName);
}
