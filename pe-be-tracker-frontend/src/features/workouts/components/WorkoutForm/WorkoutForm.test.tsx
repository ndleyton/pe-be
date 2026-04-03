import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { render } from "@/test/testUtils";
import WorkoutForm from "./WorkoutForm";

interface WorkoutType {
  id: number;
  name: string;
  description: string;
}

interface WorkoutTypeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (workoutType: WorkoutType) => void;
}

vi.mock("../WorkoutTypeModal/WorkoutTypeModal", () => ({
  default: ({ isOpen, onClose }: WorkoutTypeModalProps) =>
    isOpen ? (
      <div data-testid="workout-type-modal">
        <button onClick={onClose}>Close Modal</button>
      </div>
    ) : null,
  fetchWorkoutTypes: vi.fn(() => Promise.resolve([])),
}));

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe("WorkoutForm", () => {
  const mockOnWorkoutCreated = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the form with all required fields", () => {
    render(<WorkoutForm onWorkoutCreated={mockOnWorkoutCreated} />);

    expect(screen.getByTestId("workout-name-heading")).toHaveTextContent(/strength training/i);
    expect(screen.getByLabelText(/notes/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/start time/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /start workout/i }),
    ).toBeInTheDocument();
  });

  it("opens workout type modal when clicking workout type card", async () => {
    const user = userEvent.setup();
    render(<WorkoutForm onWorkoutCreated={mockOnWorkoutCreated} />);

    const workoutTypeCard = screen.getByTestId("open-workout-type-modal");
    await user.click(workoutTypeCard!);

    expect(screen.getByTestId("workout-type-modal")).toBeInTheDocument();
  });
});
