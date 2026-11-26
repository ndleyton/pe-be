import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient } from "@tanstack/react-query";
import { render } from "@/test/testUtils";
import api from "@/shared/api/client";
import { useAuthStore } from "@/stores";
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

vi.mock("@/shared/api/client", () => ({
  default: {
    post: vi.fn(),
  },
}));

vi.mock("../WorkoutTypeModal/WorkoutTypeModal", () => ({
  default: ({ isOpen, onClose }: WorkoutTypeModalProps) =>
    isOpen ? (
      <div data-testid="workout-type-modal">
        <button onClick={onClose}>Close Modal</button>
      </div>
    ) : null,
  fetchWorkoutTypes: vi.fn(() =>
    Promise.resolve([
      { id: 1, name: "Strength Training", description: "Lifting" },
    ]),
  ),
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
    useAuthStore.setState({
      user: null,
      isAuthenticated: false,
      loading: false,
      initialized: true,
    });
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

  it("seeds workout and empty exercises caches on authenticated creation", async () => {
    const user = userEvent.setup();
    const createdWorkout = {
      id: 77,
      name: "Upper Body",
      notes: null,
      start_time: "2026-11-26T19:00:00Z",
      end_time: null,
      workout_type_id: 1,
      created_at: "2026-11-26T19:00:00Z",
      updated_at: "2026-11-26T19:00:00Z",
    };
    vi.mocked(api.post).mockResolvedValueOnce({ data: createdWorkout });
    useAuthStore.setState({
      user: { id: 1, email: "lifter@example.com" },
      isAuthenticated: true,
      loading: false,
      initialized: true,
    });

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });

    render(<WorkoutForm onWorkoutCreated={mockOnWorkoutCreated} />, {
      queryClient,
    });

    await waitFor(() => {
      expect(screen.getByTestId("workout-name-heading")).toHaveTextContent(
        /strength training/i,
      );
    });

    await user.click(screen.getByRole("button", { name: /start workout/i }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/workouts/77", {
        state: { knownEmptyExercises: true },
      });
    });

    expect(queryClient.getQueryData(["workout", "77"])).toEqual(createdWorkout);
    expect(queryClient.getQueryData(["exercises", "77"])).toEqual([]);
  });
});
