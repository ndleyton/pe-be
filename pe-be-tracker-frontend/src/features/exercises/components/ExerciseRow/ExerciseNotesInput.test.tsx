import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ExerciseNotesInput } from "./ExerciseNotesInput";

describe("ExerciseNotesInput", () => {
  it("renders with placeholder and value", () => {
    render(
      <ExerciseNotesInput
        value="Seat pin #4"
        onChange={vi.fn()}
        onSave={vi.fn()}
      />,
    );

    const textarea = screen.getByRole("textbox", { name: /exercise notes/i });
    expect(textarea).toBeInTheDocument();
    expect(textarea).toHaveValue("Seat pin #4");
  });

  it("renders custom placeholder when provided", () => {
    render(
      <ExerciseNotesInput
        value=""
        placeholder="Custom notes placeholder"
        onChange={vi.fn()}
        onSave={vi.fn()}
      />,
    );

    expect(
      screen.getByPlaceholderText("Custom notes placeholder"),
    ).toBeInTheDocument();
  });

  it("calls onChange when typing", async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    render(
      <ExerciseNotesInput
        value=""
        onChange={handleChange}
        onSave={vi.fn()}
      />,
    );

    const textarea = screen.getByRole("textbox", { name: /exercise notes/i });
    await user.type(textarea, "A");

    expect(handleChange).toHaveBeenCalledWith("A");
  });

  it("calls onSave and shows saved indicator on blur when content changes", async () => {
    const handleSave = vi.fn();

    const { rerender } = render(
      <ExerciseNotesInput
        value="Initial"
        onChange={vi.fn()}
        onSave={handleSave}
      />,
    );

    const textarea = screen.getByRole("textbox", { name: /exercise notes/i });

    // Update value prop as would happen in controlled parent
    rerender(
      <ExerciseNotesInput
        value="Updated notes"
        onChange={vi.fn()}
        onSave={handleSave}
      />,
    );

    fireEvent.blur(textarea);

    expect(handleSave).toHaveBeenCalledWith("Updated notes");
    expect(await screen.findByTestId("notes-saved-indicator")).toBeInTheDocument();
    expect(screen.getByText("Saved")).toBeInTheDocument();
  });

  it("does not show saved indicator on blur if value is unchanged", () => {
    const handleSave = vi.fn();

    render(
      <ExerciseNotesInput
        value="Same value"
        onChange={vi.fn()}
        onSave={handleSave}
      />,
    );

    const textarea = screen.getByRole("textbox", { name: /exercise notes/i });
    fireEvent.blur(textarea);

    expect(handleSave).toHaveBeenCalledWith("Same value");
    expect(
      screen.queryByTestId("notes-saved-indicator"),
    ).not.toBeInTheDocument();
  });

  it("does not show saved indicator if onSave rejects", async () => {
    const handleSave = vi.fn().mockRejectedValue(new Error("Persistence failed"));

    const { rerender } = render(
      <ExerciseNotesInput
        value="Initial"
        onChange={vi.fn()}
        onSave={handleSave}
      />,
    );

    const textarea = screen.getByRole("textbox", { name: /exercise notes/i });

    rerender(
      <ExerciseNotesInput
        value="Updated notes"
        onChange={vi.fn()}
        onSave={handleSave}
      />,
    );

    await fireEvent.blur(textarea);

    expect(handleSave).toHaveBeenCalledWith("Updated notes");
    expect(
      screen.queryByTestId("notes-saved-indicator"),
    ).not.toBeInTheDocument();
  });

  it("awaits async onSave and shows saved indicator on success", async () => {
    let resolvePromise: () => void = () => {};
    const handleSave = vi.fn().mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolvePromise = resolve;
        }),
    );

    const { rerender } = render(
      <ExerciseNotesInput
        value="Initial"
        onChange={vi.fn()}
        onSave={handleSave}
      />,
    );

    const textarea = screen.getByRole("textbox", { name: /exercise notes/i });

    rerender(
      <ExerciseNotesInput
        value="Updated notes"
        onChange={vi.fn()}
        onSave={handleSave}
      />,
    );

    fireEvent.blur(textarea);

    // Before resolve, indicator should not be shown
    expect(
      screen.queryByTestId("notes-saved-indicator"),
    ).not.toBeInTheDocument();

    // After resolve
    resolvePromise();
    await screen.findByTestId("notes-saved-indicator");
    expect(screen.getByText("Saved")).toBeInTheDocument();
  });
});
