import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { render } from "@/test/utils";
import WorkoutPage from "./WorkoutPage";

// Mock react-router-dom
const mockNavigate = vi.fn();
const mockWorkoutId = "123";

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useParams: () => ({ workoutId: mockWorkoutId }),
    useNavigate: () => mockNavigate,
  };
});

// Mock exercise-related components used by WorkoutPage
vi.mock("@/features/exercises/components", () => ({
  ExerciseList: () => <div data-testid="exercise-list">Mock Exercise List</div>,
  ExerciseTypeModal: () => <div data-testid="exercise-type-modal" />,
}));

describe("WorkoutPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders workout page with correct heading", () => {
    render(<WorkoutPage />);

    expect(
      screen.getByRole("heading", { name: /workout: #123/i, level: 2 }),
    ).toBeInTheDocument();
  });

  it("shows floating action button", () => {
    render(<WorkoutPage />);

    expect(
      screen.getByLabelText(/floating action button/i),
    ).toBeInTheDocument();
  });

  it('shows "Add Exercise" button', () => {
    render(<WorkoutPage />);
    expect(screen.getByRole("button", { name: /add exercise/i })).toBeInTheDocument();
  });
});
