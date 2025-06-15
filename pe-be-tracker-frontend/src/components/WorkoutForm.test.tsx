import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import api from '../api/client';
import { render } from '../test/utils';
import WorkoutForm from './WorkoutForm';

vi.mock('../api/client');
const mockedApi = vi.mocked(api, true);

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('WorkoutForm', () => {
  const mockOnWorkoutCreated = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the form with all required fields', () => {
    render(<WorkoutForm onWorkoutCreated={mockOnWorkoutCreated} />);

    expect(screen.getByRole('heading', { name: /create workout/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/notes/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/start time/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/workout type id/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create workout/i })).toBeInTheDocument();
    
    // Verify end time field is NOT present (removed as per requirements)
    expect(screen.queryByLabelText(/end time/i)).not.toBeInTheDocument();
  });

  it('shows validation errors for required fields', async () => {
    const user = userEvent.setup();
    render(<WorkoutForm onWorkoutCreated={mockOnWorkoutCreated} />);

    // Clear the start time field (it has a default value)
    const startTimeInput = screen.getByLabelText(/start time/i);
    await user.clear(startTimeInput);

    const submitButton = screen.getByRole('button', { name: /create workout/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/start time is required/i)).toBeInTheDocument();
      expect(screen.getByText(/workout type is required/i)).toBeInTheDocument();
    });
  });

  it('shows validation error for invalid workout type id', async () => {
    const user = userEvent.setup();
    render(<WorkoutForm onWorkoutCreated={mockOnWorkoutCreated} />);

    const workoutTypeInput = screen.getByLabelText(/workout type id/i);
    await user.type(workoutTypeInput, '-1');

    const submitButton = screen.getByRole('button', { name: /create workout/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/workout type id must be positive/i)).toBeInTheDocument();
    });
  });

  it('successfully creates a workout with valid data', async () => {
    const user = userEvent.setup();
    const mockWorkout = { id: 123, name: 'Test Workout' };
    
    mockedApi.post.mockResolvedValueOnce({ data: mockWorkout });

    render(<WorkoutForm onWorkoutCreated={mockOnWorkoutCreated} />);

    // Fill out the form
    await user.type(screen.getByLabelText(/name/i), 'Test Workout');
    await user.type(screen.getByLabelText(/notes/i), 'Test notes');
    await user.clear(screen.getByLabelText(/start time/i));
    await user.type(screen.getByLabelText(/start time/i), '2024-01-01T10:00');
    await user.type(screen.getByLabelText(/workout type id/i), '1');

    const submitButton = screen.getByRole('button', { name: /create workout/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockedApi.post).toHaveBeenCalledWith(
        '/workouts/',
        expect.objectContaining({
          name: 'Test Workout',
          notes: 'Test notes',
          workout_type_id: 1,
          start_time: expect.stringMatching(/2024-01-01T\d{2}:00:00\.000Z/),
          end_time: null, // End time is no longer sent from the form
        }),
      );
    });

    await waitFor(() => {
      expect(mockOnWorkoutCreated).toHaveBeenCalledWith(123);
      expect(mockNavigate).toHaveBeenCalledWith('/workout/123');
    });
  });

  it('shows loading state during submission', async () => {
    const user = userEvent.setup();
    
    // Mock a delayed response
    mockedApi.post.mockImplementation(() => 
      new Promise(resolve => setTimeout(() => resolve({ data: { id: 123 } }), 100))
    );

    render(<WorkoutForm onWorkoutCreated={mockOnWorkoutCreated} />);

    // Fill required fields
    await user.clear(screen.getByLabelText(/start time/i));
    await user.type(screen.getByLabelText(/start time/i), '2024-01-01T10:00');
    await user.type(screen.getByLabelText(/workout type id/i), '1');

    const submitButton = screen.getByRole('button', { name: /create workout/i });
    await user.click(submitButton);

    // Check loading state
    expect(screen.getByRole('button', { name: /creating/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /creating/i })).toBeDisabled();
  });

  it('shows error message when submission fails', async () => {
    const user = userEvent.setup();
    
    mockedApi.post.mockRejectedValueOnce(new Error('Network error'));

    render(<WorkoutForm onWorkoutCreated={mockOnWorkoutCreated} />);

    // Fill required fields
    await user.clear(screen.getByLabelText(/start time/i));
    await user.type(screen.getByLabelText(/start time/i), '2024-01-01T10:00');
    await user.type(screen.getByLabelText(/workout type id/i), '1');

    const submitButton = screen.getByRole('button', { name: /create workout/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/failed to create workout/i)).toBeInTheDocument();
    });
  });

  it('resets form after successful submission', async () => {
    const user = userEvent.setup();
    const mockWorkout = { id: 123 };
    
    mockedApi.post.mockResolvedValueOnce({ data: mockWorkout });

    render(<WorkoutForm onWorkoutCreated={mockOnWorkoutCreated} />);

    const nameInput = screen.getByLabelText(/name/i) as HTMLInputElement;
    const notesInput = screen.getByLabelText(/notes/i) as HTMLInputElement;
    const startTimeInput = screen.getByLabelText(/start time/i) as HTMLInputElement;
    const workoutTypeInput = screen.getByLabelText(/workout type id/i) as HTMLInputElement;

    // Fill out the form
    await user.type(nameInput, 'Test Workout');
    await user.type(notesInput, 'Test notes');
    await user.clear(startTimeInput);
    await user.type(startTimeInput, '2024-01-01T10:00');
    await user.type(workoutTypeInput, '1');

    const submitButton = screen.getByRole('button', { name: /create workout/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(nameInput.value).toBe('');
      expect(notesInput.value).toBe('');
      expect(startTimeInput.value).toBe(new Date().toISOString().slice(0, 16)); // Should reset to current time default
      expect(workoutTypeInput.value).toBe('');
    });

    vi.useRealTimers();
  });
});