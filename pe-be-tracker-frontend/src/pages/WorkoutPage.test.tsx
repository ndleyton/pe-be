import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient } from '@tanstack/react-query';
import { render } from '../test/utils';
import api from '../api/client';
import WorkoutPage from './WorkoutPage';

// Mock the API client
vi.mock('../api/client');
const mockedApi = vi.mocked(api, true);

// Mock react-router-dom
const mockNavigate = vi.fn();
const mockWorkoutId = '123';

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useParams: () => ({ workoutId: mockWorkoutId }),
    useNavigate: () => mockNavigate,
  };
});

// Mock the ExerciseForm component
interface ExerciseFormProps {
  workoutId: string;
  onExerciseCreated: () => void;
}

vi.mock('../components/ExerciseForm', () => ({
  default: ({ workoutId, onExerciseCreated }: ExerciseFormProps) => (
    <div data-testid="exercise-form">
      <span>Exercise Form for Workout {workoutId}</span>
      <button onClick={onExerciseCreated} data-testid="mock-exercise-created">
        Mock Exercise Created
      </button>
    </div>
  ),
}));

// Mock the FinishWorkoutModal component
interface FinishWorkoutModalProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading: boolean;
}

vi.mock('../components/FinishWorkoutModal', () => ({
  default: ({ isOpen, onConfirm, onCancel, isLoading }: FinishWorkoutModalProps) =>
    isOpen ? (
      <div data-testid="finish-workout-modal">
        <button onClick={onConfirm} disabled={isLoading}>
          Confirm Finish
        </button>
        <button onClick={onCancel}>Cancel</button>
      </div>
    ) : null,
}));

describe('WorkoutPage', () => {
  const mockExercises = [
    {
      id: 1,
      timestamp: '2024-01-01T10:30:00Z',
      notes: 'First exercise',
      exercise_type_id: 101,
      workout_id: 123,
      created_at: '2024-01-01T10:00:00Z',
      updated_at: '2024-01-01T10:00:00Z',
      exercise_type: {
        id: 101,
        name: 'Bench Press',
        description: 'Chest exercise',
        default_intensity_unit: 1,
        created_at: '2024-01-01T09:00:00Z',
        updated_at: '2024-01-01T09:00:00Z',
      },
    },
    {
      id: 2,
      timestamp: null,
      notes: 'Second exercise',
      exercise_type_id: 102,
      workout_id: 123,
      created_at: '2024-01-01T10:05:00Z',
      updated_at: '2024-01-01T10:05:00Z',
      exercise_type: {
        id: 102,
        name: 'Squat',
        description: 'Leg exercise',
        default_intensity_unit: 1,
        created_at: '2024-01-01T09:00:00Z',
        updated_at: '2024-01-01T09:00:00Z',
      },
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    // Mock window.history.pushState
    Object.defineProperty(window, 'history', {
      value: { pushState: vi.fn() },
      writable: true,
    });
  });

  it('renders workout page with correct heading', async () => {
    mockedApi.get.mockResolvedValueOnce({ data: [] });

    render(<WorkoutPage />);

    expect(screen.getByText(`Log Exercises for Workout #${mockWorkoutId}`)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /finish workout/i })).toBeInTheDocument();
  });

  it('fetches and renders exercises on mount', async () => {
    mockedApi.get.mockResolvedValueOnce({ data: mockExercises });

    render(<WorkoutPage />);

    // Wait for exercises to load
    await waitFor(() => {
      expect(mockedApi.get).toHaveBeenCalledWith(`/exercises/workouts/${mockWorkoutId}`);
    });

    await waitFor(() => {
      expect(screen.getByText('Exercises (2)')).toBeInTheDocument();
      expect(screen.getByText('Bench Press')).toBeInTheDocument();
      expect(screen.getByText('Squat')).toBeInTheDocument();
      expect(screen.getByText('Chest exercise')).toBeInTheDocument();
      expect(screen.getByText('Leg exercise')).toBeInTheDocument();
      expect(screen.getByText('First exercise')).toBeInTheDocument();
      expect(screen.getByText('Second exercise')).toBeInTheDocument();
    });
  });

  it('shows loading state while fetching exercises', () => {
    mockedApi.get.mockImplementation(() => new Promise(() => {})); // Never resolves

    render(<WorkoutPage />);

    expect(screen.getByText(/loading exercises/i)).toBeInTheDocument();
  });

  it('shows error state when exercise fetch fails', async () => {
    mockedApi.get.mockRejectedValueOnce(new Error('Network error'));

    render(<WorkoutPage />);

    await waitFor(() => {
      expect(screen.getByText(/failed to load exercises/i)).toBeInTheDocument();
    });
  });

  it('shows empty state when no exercises exist', async () => {
    mockedApi.get.mockResolvedValueOnce({ data: [] });

    render(<WorkoutPage />);

    await waitFor(() => {
      expect(screen.getByText('Exercises (0)')).toBeInTheDocument();
      expect(screen.getByText(/no exercises added yet/i)).toBeInTheDocument();
    });
  });

  it('refetches exercises when onExerciseCreated is called', async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0 },
        mutations: { retry: false },
      },
    });

    // Initial fetch returns empty array
    mockedApi.get.mockResolvedValueOnce({ data: [] });

    render(<WorkoutPage />, { queryClient });

    await waitFor(() => {
      expect(screen.getByText('Exercises (0)')).toBeInTheDocument();
    });

    // Clear the mock call history
    mockedApi.get.mockClear();

    // Second fetch returns exercises after form submission
    mockedApi.get.mockResolvedValueOnce({ data: mockExercises });

    // Simulate exercise creation
    const mockExerciseCreatedButton = screen.getByTestId('mock-exercise-created');
    await userEvent.setup().click(mockExerciseCreatedButton);

    // Should refetch exercises
    await waitFor(() => {
      expect(mockedApi.get).toHaveBeenCalledWith(`/exercises/workouts/${mockWorkoutId}`);
    });

    await waitFor(() => {
      expect(screen.getByText('Exercises (2)')).toBeInTheDocument();
    });
  });

  it('renders ExerciseForm with correct props', async () => {
    mockedApi.get.mockResolvedValueOnce({ data: [] });

    render(<WorkoutPage />);

    await waitFor(() => {
      expect(screen.getByTestId('exercise-form')).toBeInTheDocument();
      expect(screen.getByText(`Exercise Form for Workout ${mockWorkoutId}`)).toBeInTheDocument();
    });
  });

  it('opens finish workout modal when finish button is clicked', async () => {
    const user = userEvent.setup();
    mockedApi.get.mockResolvedValueOnce({ data: [] });

    render(<WorkoutPage />);

    const finishButton = screen.getByRole('button', { name: /finish workout/i });
    await user.click(finishButton);

    expect(screen.getByTestId('finish-workout-modal')).toBeInTheDocument();
  });

  it('handles workout finish confirmation', async () => {
    const user = userEvent.setup();
    mockedApi.get.mockResolvedValueOnce({ data: [] });
    mockedApi.patch.mockResolvedValueOnce({ data: { id: 123 } });

    render(<WorkoutPage />);

    // Open modal
    const finishButton = screen.getByRole('button', { name: /finish workout/i });
    await user.click(finishButton);

    // Confirm finish
    const confirmButton = screen.getByText('Confirm Finish');
    await user.click(confirmButton);

    await waitFor(() => {
      expect(mockedApi.patch).toHaveBeenCalledWith(
        `/workouts/${mockWorkoutId}`,
        expect.objectContaining({
          end_time: expect.any(String),
        })
      );
    });

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/workouts');
    });
  });

  it('displays exercises with correct timestamps', async () => {
    mockedApi.get.mockResolvedValueOnce({ data: mockExercises });

    render(<WorkoutPage />);

    await waitFor(() => {
      // First exercise has timestamp - be flexible with time formatting
      expect(screen.getByText(/1\/1\/2024.*:30:00/)).toBeInTheDocument();
      
      // Second exercise shows created_at since timestamp is null
      expect(screen.getByText(/Created: 1\/1\/2024/)).toBeInTheDocument();
    });
  });

  it('displays exercise type initials in avatar icons', async () => {
    mockedApi.get.mockResolvedValueOnce({ data: mockExercises });

    render(<WorkoutPage />);

    await waitFor(() => {
      expect(screen.getByText('B')).toBeInTheDocument(); // Bench Press initial
      expect(screen.getByText('S')).toBeInTheDocument(); // Squat initial
    });
  });
});