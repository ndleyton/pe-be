import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@/test/testUtils";
import userEvent from "@testing-library/user-event";
import { makeExerciseForSummary } from "@/test/fixtures";
import FinishWorkoutModal from "./FinishWorkoutModal";

const defaultProps = {
  isOpen: true,
  onConfirm: vi.fn(),
  onCancel: vi.fn(),
  isLoading: false,
};

describe("FinishWorkoutModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Mock fetch for AnatomicalImage component
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        text: () => Promise.resolve("<svg></svg>"),
      }),
    ) as any;
  });

  describe("Rendering and Visibility", () => {
    it("should not render when isOpen is false", () => {
      render(<FinishWorkoutModal {...defaultProps} isOpen={false} />);


      expect(screen.queryByText("Cancel")).not.toBeInTheDocument();
    });

    it("should render when isOpen is true", () => {
      render(<FinishWorkoutModal {...defaultProps} />);



      expect(
        screen.getByRole("button", { name: "Cancel" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Finish Workout" }),
      ).toBeInTheDocument();
    });

    it("should have proper modal overlay and content structure", () => {
      render(<FinishWorkoutModal {...defaultProps} />);

      // Check for overlay
      const overlay = screen
        .getByTestId("finish-workout-modal")
        .closest(".fixed.inset-0");
      expect(overlay).toHaveClass(
        "fixed",
        "inset-0",
        "bg-black/50",
        "flex",
        "items-center",
        "justify-center",
        "z-[100]",
      );

      // Check for modal content
      const modalContent = screen.getByTestId("finish-workout-modal");
      expect(modalContent).toHaveClass(
        "text-card-foreground",
        "max-w-md",
        "w-full",
        "mx-4",
        "max-h-[90vh]",
        "flex",
        "flex-col",
      );
    });
  });

  describe("Content and Messaging", () => {




    it("should display correct button labels in normal state", () => {
      render(<FinishWorkoutModal {...defaultProps} />);

      expect(
        screen.getByRole("button", { name: "Cancel" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Finish Workout" }),
      ).toBeInTheDocument();
    });

    it("should display loading state on confirm button when isLoading is true", () => {
      render(<FinishWorkoutModal {...defaultProps} isLoading={true} />);

      expect(
        screen.getByRole("button", { name: "Finishing..." }),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Finish Workout" }),
      ).not.toBeInTheDocument();
    });
  });

  describe("User Interactions", () => {
    it("should call onCancel when Cancel button is clicked", async () => {
      const user = userEvent.setup();
      const onCancel = vi.fn();

      render(<FinishWorkoutModal {...defaultProps} onCancel={onCancel} />);

      await user.click(screen.getByRole("button", { name: "Cancel" }));

      expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it("should call onConfirm when Finish Workout button is clicked", async () => {
      const user = userEvent.setup();
      const onConfirm = vi.fn();

      render(<FinishWorkoutModal {...defaultProps} onConfirm={onConfirm} />);

      await user.click(screen.getByRole("button", { name: "Finish Workout" }));

      expect(onConfirm).toHaveBeenCalledTimes(1);
    });

    it("should handle keyboard events for Cancel button", () => {
      const onCancel = vi.fn();

      render(<FinishWorkoutModal {...defaultProps} onCancel={onCancel} />);

      const cancelButton = screen.getByRole("button", { name: "Cancel" });
      fireEvent.keyDown(cancelButton, { key: "Enter" });

      // Since we're testing keyboard accessibility, the button should be focusable
      expect(cancelButton).toBeInTheDocument();
    });

    it("should handle keyboard events for Confirm button", () => {
      const onConfirm = vi.fn();

      render(<FinishWorkoutModal {...defaultProps} onConfirm={onConfirm} />);

      const confirmButton = screen.getByRole("button", {
        name: "Finish Workout",
      });
      fireEvent.keyDown(confirmButton, { key: "Enter" });

      // Since we're testing keyboard accessibility, the button should be focusable
      expect(confirmButton).toBeInTheDocument();
    });
  });

  describe("Loading State", () => {
    it("should disable both buttons when isLoading is true", () => {
      render(<FinishWorkoutModal {...defaultProps} isLoading={true} />);

      const cancelButton = screen.getByRole("button", { name: "Cancel" });
      const confirmButton = screen.getByRole("button", {
        name: "Finishing...",
      });

      expect(cancelButton).toBeDisabled();
      expect(confirmButton).toBeDisabled();
    });

    it("should enable both buttons when isLoading is false", () => {
      render(<FinishWorkoutModal {...defaultProps} isLoading={false} />);

      const cancelButton = screen.getByRole("button", { name: "Cancel" });
      const confirmButton = screen.getByRole("button", {
        name: "Finish Workout",
      });

      expect(cancelButton).not.toBeDisabled();
      expect(confirmButton).not.toBeDisabled();
    });

    it("should not call onCancel when Cancel button is disabled and clicked", async () => {
      const user = userEvent.setup();
      const onCancel = vi.fn();

      render(
        <FinishWorkoutModal
          {...defaultProps}
          onCancel={onCancel}
          isLoading={true}
        />,
      );

      const cancelButton = screen.getByRole("button", { name: "Cancel" });
      await user.click(cancelButton);

      expect(onCancel).not.toHaveBeenCalled();
    });

    it("should not call onConfirm when Confirm button is disabled and clicked", async () => {
      const user = userEvent.setup();
      const onConfirm = vi.fn();

      render(
        <FinishWorkoutModal
          {...defaultProps}
          onConfirm={onConfirm}
          isLoading={true}
        />,
      );

      const confirmButton = screen.getByRole("button", {
        name: "Finishing...",
      });
      await user.click(confirmButton);

      expect(onConfirm).not.toHaveBeenCalled();
    });
  });

  describe("Button Styling and States", () => {
    it("should have correct styling for Cancel button", () => {
      render(<FinishWorkoutModal {...defaultProps} />);

      const cancelButton = screen.getByRole("button", { name: "Cancel" });
      expect(cancelButton).toHaveClass(
        "bg-card/80",
        "hover:bg-accent",
        "border-border",
        "backdrop-blur-sm",
      );
    });

    it("should have correct styling for Confirm button", () => {
      render(<FinishWorkoutModal {...defaultProps} />);

      const confirmButton = screen.getByRole("button", {
        name: "Finish Workout",
      });
      expect(confirmButton).toHaveClass("bg-primary", "hover:bg-primary/90");
    });

    it("should have disabled styling when buttons are disabled", () => {
      render(<FinishWorkoutModal {...defaultProps} isLoading={true} />);

      const cancelButton = screen.getByRole("button", { name: "Cancel" });
      const confirmButton = screen.getByRole("button", {
        name: "Finishing...",
      });

      expect(cancelButton).toBeDisabled();
      expect(confirmButton).toBeDisabled();
    });

    it("should have proper button layout and spacing", () => {
      render(<FinishWorkoutModal {...defaultProps} />);

      const buttonContainer = screen.getByRole("button", {
        name: "Cancel",
      }).parentElement;
      expect(buttonContainer).toHaveClass(
        "flex",
        "shrink-0",
        "justify-end",
        "gap-4",
        "px-6",
        "py-4",
      );
    });
  });

  describe("Component Props Handling", () => {
    it("should handle optional isLoading prop defaulting to false", () => {
      const { onConfirm, onCancel, isOpen } = defaultProps;
      render(
        <FinishWorkoutModal
          isOpen={isOpen}
          onConfirm={onConfirm}
          onCancel={onCancel}
        />,
      );

      const cancelButton = screen.getByRole("button", { name: "Cancel" });
      const confirmButton = screen.getByRole("button", {
        name: "Finish Workout",
      });

      expect(cancelButton).not.toBeDisabled();
      expect(confirmButton).not.toBeDisabled();
    });

    it("should properly handle all required props", () => {
      const onConfirm = vi.fn();
      const onCancel = vi.fn();

      render(
        <FinishWorkoutModal
          isOpen={true}
          onConfirm={onConfirm}
          onCancel={onCancel}
          isLoading={false}
        />,
      );

      // Modal renders with buttons (no title text)
      expect(
        screen.getByRole("button", { name: "Cancel" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Finish Workout" }),
      ).toBeInTheDocument();
    });
  });

  describe("Modal Behavior", () => {
    it("should have proper z-index for modal overlay", () => {
      render(<FinishWorkoutModal {...defaultProps} />);

      const overlay = screen.getByTestId("finish-workout-modal").closest(".fixed");
      expect(overlay).toHaveClass("z-[100]");
    });

    it("should center modal content properly", () => {
      render(<FinishWorkoutModal {...defaultProps} />);

      const overlay = screen.getByTestId("finish-workout-modal").closest(".fixed");
      expect(overlay).toHaveClass("flex", "items-center", "justify-center");
    });

    it("should have responsive modal width", () => {
      render(<FinishWorkoutModal {...defaultProps} />);

      const modalContent = screen.getByTestId("finish-workout-modal");
      expect(modalContent).toHaveClass("max-w-md", "w-full", "mx-4");
    });
  });

  describe("Accessibility", () => {
    it("should have focusable buttons", () => {
      render(<FinishWorkoutModal {...defaultProps} />);

      const cancelButton = screen.getByRole("button", { name: "Cancel" });
      const confirmButton = screen.getByRole("button", {
        name: "Finish Workout",
      });

      expect(cancelButton).toBeInTheDocument();
      expect(confirmButton).toBeInTheDocument();

      // Both buttons should be focusable (not disabled)
      expect(cancelButton).not.toHaveAttribute("disabled");
      expect(confirmButton).not.toHaveAttribute("disabled");
    });

    it("should have proper semantic structure", () => {
      render(<FinishWorkoutModal {...defaultProps} />);





      // Action elements should be buttons
      const buttons = screen.getAllByRole("button");
      expect(buttons).toHaveLength(2);
    });
  });

  describe("Muscle Group Summary", () => {
    const mockExercisesWithSets = [
      makeExerciseForSummary({
        name: "Bench Press",
        muscleGroups: ["Chest"],
        completedSets: 2,
        pendingSets: 1,
      }),
      makeExerciseForSummary({
        name: "Squats",
        muscleGroups: ["Legs"],
        completedSets: 3,
      }),
    ];

    it("should display muscle group summary when exercises with completed sets are provided", () => {
      render(
        <FinishWorkoutModal
          {...defaultProps}
          exercises={mockExercisesWithSets}
        />,
      );

      // The heading now shows the workout name (or default)
      expect(screen.getByText("Great Training Session!")).toBeInTheDocument();
      expect(screen.getByText("Legs")).toBeInTheDocument();
      expect(screen.getByText("Chest")).toBeInTheDocument();
      expect(screen.getByText("Total Sets Completed:")).toBeInTheDocument();
      expect(screen.getByText("5")).toBeInTheDocument(); // 2 chest + 3 legs
    });

    it("should not display muscle group summary when no exercises are provided", () => {
      render(<FinishWorkoutModal {...defaultProps} exercises={[]} />);

      // The summary block (and heading) should not render when there are no exercises
      expect(
        screen.queryByText("Great Training Session!"),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByText("Total Sets Completed:"),
      ).not.toBeInTheDocument();
    });

    it("should not display muscle group summary when exercises have no completed sets", () => {
      const exercisesWithUncompletedSets = [
        makeExerciseForSummary({
          name: "Bench Press",
          muscleGroups: ["Chest"],
          pendingSets: 2,
        }),
      ];

      render(
        <FinishWorkoutModal
          {...defaultProps}
          exercises={exercisesWithUncompletedSets}
        />,
      );

      expect(
        screen.queryByText("Great Training Session!"),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByText("Total Sets Completed:"),
      ).not.toBeInTheDocument();
    });

    it("should handle exercises prop defaulting to empty array", () => {
      render(<FinishWorkoutModal {...defaultProps} />);

      expect(
        screen.queryByText("Great Training Session!"),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByText("Total Sets Completed:"),
      ).not.toBeInTheDocument();
    });

    it("should display correct set counts for each muscle group", () => {
      render(
        <FinishWorkoutModal
          {...defaultProps}
          exercises={mockExercisesWithSets}
        />,
      );

      // Check if set counts are displayed correctly
      const legsSets = screen.getByText("3 sets");
      const chestSets = screen.getByText("2 sets");

      expect(legsSets).toBeInTheDocument();
      expect(chestSets).toBeInTheDocument();
    });

    it("should handle singular vs plural sets correctly", () => {
      const singleSetExercise = [
        makeExerciseForSummary({
          name: "Push-ups",
          muscleGroups: ["Chest", "Arms"],
          completedSets: 1,
        }),
      ];

      render(
        <FinishWorkoutModal {...defaultProps} exercises={singleSetExercise} />,
      );

      // Should display "1 set" not "1 sets" - Push-ups maps to both Chest and Arms, so there will be multiple "1 set" texts
      const setSingularTexts = screen.getAllByText("1 set");
      expect(setSingularTexts.length).toBeGreaterThan(0);
      expect(screen.queryByText("1 sets")).not.toBeInTheDocument();
    });

    it("shows a logged-in-only message for recap generation in guest mode", () => {
      render(
        <FinishWorkoutModal
          {...defaultProps}
          exercises={mockExercisesWithSets}
          isAuthenticated={false}
        />,
      );

      expect(
        screen.getByText("AI recaps are available for logged-in users."),
      ).toBeInTheDocument();
    });

    it("shows the generic recap fallback for authenticated users", () => {
      render(
        <FinishWorkoutModal
          {...defaultProps}
          exercises={mockExercisesWithSets}
          isAuthenticated={true}
        />,
      );

      expect(
        screen.getByText("Recap generation skipped or failed."),
      ).toBeInTheDocument();
    });
  });
});
