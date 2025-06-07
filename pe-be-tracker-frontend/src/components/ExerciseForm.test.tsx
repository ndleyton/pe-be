import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axios from 'axios';
import { render } from '../test/utils';
import ExerciseForm from './ExerciseForm';

vi.mock('axios');
const mockedAxios = vi.mocked(axios);

describe('ExerciseForm', () => {
  const mockOnExerciseCreated = vi.fn();
  const defaultProps = {
    workoutId: '123',
    onExerciseCreated: mockOnExerciseCreated,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the form with all fields', () => {
    render(<ExerciseForm {...defaultProps} />);

    expect(screen.getByRole('heading', { name: /add exercise/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/exercise type id/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/timestamp/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/notes/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add exercise/i })).toBeInTheDocument();
  });

  it('shows validation error for required exercise type field', async () => {
    const user = userEvent.setup();
    render(<ExerciseForm {...defaultProps} />);

    const submitButton = screen.getByRole('button', { name: /add exercise/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/exercise type is required/i)).toBeInTheDocument();
    });
  });

  it('shows validation error for invalid exercise type id', async () => {
    const user = userEvent.setup();
    render(<ExerciseForm {...defaultProps} />);

    const exerciseTypeInput = screen.getByLabelText(/exercise type id/i);
    await user.type(exerciseTypeInput, '-1');

    const submitButton = screen.getByRole('button', { name: /add exercise/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/exercise type id must be positive/i)).toBeInTheDocument();
    });
  });

  it('successfully creates an exercise with required data only', async () => {
    const user = userEvent.setup();
    const mockExercise = { id: 456, exercise_type_id: 1 };
    
    mockedAxios.post.mockResolvedValueOnce({ data: mockExercise });

    render(<ExerciseForm {...defaultProps} />);

    // Fill only required field
    await user.type(screen.getByLabelText(/exercise type id/i), '1');

    const submitButton = screen.getByRole('button', { name: /add exercise/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockedAxios.post).toHaveBeenCalledWith(
        'http://localhost:8000/api/exercises/',
        {
          exercise_type_id: 1,
          workout_id: 123,
          timestamp: null,
          notes: null,
        },
        { withCredentials: true }
      );
    });

    await waitFor(() => {
      expect(mockOnExerciseCreated).toHaveBeenCalled();
    });
  });

  it('successfully creates an exercise with all data', async () => {
    const user = userEvent.setup();
    const mockExercise = { id: 456 };
    
    mockedAxios.post.mockResolvedValueOnce({ data: mockExercise });

    render(<ExerciseForm {...defaultProps} />);

    // Fill all fields
    await user.type(screen.getByLabelText(/exercise type id/i), '2');
    await user.type(screen.getByLabelText(/timestamp/i), '2024-01-01T10:30');
    await user.type(screen.getByLabelText(/notes/i), 'Great set!');

    const submitButton = screen.getByRole('button', { name: /add exercise/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockedAxios.post).toHaveBeenCalledWith(
        'http://localhost:8000/api/exercises/',
        expect.objectContaining({
          exercise_type_id: 2,
          workout_id: 123,
          timestamp: expect.stringMatching(/2024-01-01T\d{2}:30:00\.000Z/),
          notes: 'Great set!',
        }),
        { withCredentials: true }
      );
    });
  });

  it('shows loading state during submission', async () => {
    const user = userEvent.setup();
    
    // Mock a delayed response
    mockedAxios.post.mockImplementation(() => 
      new Promise(resolve => setTimeout(() => resolve({ data: { id: 456 } }), 100))
    );

    render(<ExerciseForm {...defaultProps} />);

    // Fill required field
    await user.type(screen.getByLabelText(/exercise type id/i), '1');

    const submitButton = screen.getByRole('button', { name: /add exercise/i });
    await user.click(submitButton);

    // Check loading state
    expect(screen.getByRole('button', { name: /adding/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /adding/i })).toBeDisabled();
  });

  it('shows error message when submission fails', async () => {
    const user = userEvent.setup();
    
    mockedAxios.post.mockRejectedValueOnce(new Error('Network error'));

    render(<ExerciseForm {...defaultProps} />);

    // Fill required field
    await user.type(screen.getByLabelText(/exercise type id/i), '1');

    const submitButton = screen.getByRole('button', { name: /add exercise/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/failed to create exercise/i)).toBeInTheDocument();
    });
  });

  it('resets form after successful submission', async () => {
    const user = userEvent.setup();
    const mockExercise = { id: 456 };
    
    mockedAxios.post.mockResolvedValueOnce({ data: mockExercise });

    render(<ExerciseForm {...defaultProps} />);

    const exerciseTypeInput = screen.getByLabelText(/exercise type id/i) as HTMLInputElement;
    const timestampInput = screen.getByLabelText(/timestamp/i) as HTMLInputElement;
    const notesInput = screen.getByLabelText(/notes/i) as HTMLInputElement;

    // Fill out the form
    await user.type(exerciseTypeInput, '1');
    await user.type(timestampInput, '2024-01-01T10:30');
    await user.type(notesInput, 'Test notes');

    const submitButton = screen.getByRole('button', { name: /add exercise/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(exerciseTypeInput.value).toBe('');
      expect(timestampInput.value).toBe('');
      expect(notesInput.value).toBe('');
    });
  });

  it('converts workoutId prop to number for API call', async () => {
    const user = userEvent.setup();
    const mockExercise = { id: 456 };
    
    mockedAxios.post.mockResolvedValueOnce({ data: mockExercise });

    render(<ExerciseForm workoutId="999" onExerciseCreated={mockOnExerciseCreated} />);

    await user.type(screen.getByLabelText(/exercise type id/i), '1');

    const submitButton = screen.getByRole('button', { name: /add exercise/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockedAxios.post).toHaveBeenCalledWith(
        'http://localhost:8000/api/exercises/',
        expect.objectContaining({
          workout_id: 999, // Should be converted to number
        }),
        { withCredentials: true }
      );
    });
  });
});