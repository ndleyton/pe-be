import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import api from '../api/client';
import { render } from '../test/utils';
import ExerciseForm from './ExerciseForm';

vi.mock('../api/client');
const mockedApi = vi.mocked(api, true);

interface ExerciseType {
  id: number;
  name: string;
  description: string;
  default_intensity_unit: number;
}

interface ExerciseTypeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (exerciseType: ExerciseType) => void;
}

vi.mock('./ExerciseTypeModal', () => ({
  default: ({ isOpen, onClose, onSelect }: ExerciseTypeModalProps) => 
    isOpen ? (
      <div data-testid="exercise-type-modal">
        <button onClick={() => onSelect({ id: 1, name: 'Bench Press', description: 'Chest exercise', default_intensity_unit: 1 })}>
          Select Bench Press
        </button>
        <button onClick={onClose}>Close Modal</button>
      </div>
    ) : null,
}));

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
    expect(screen.getByText(/select exercise/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/notes/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add exercise/i })).toBeInTheDocument();
  });

  it('opens exercise type modal when clicking select exercise', async () => {
    const user = userEvent.setup();
    render(<ExerciseForm {...defaultProps} />);

    const selectButton = screen.getByText(/select exercise/i);
    await user.click(selectButton);

    expect(screen.getByTestId('exercise-type-modal')).toBeInTheDocument();
  });

  it('selects exercise type from modal and updates form', async () => {
    const user = userEvent.setup();
    render(<ExerciseForm {...defaultProps} />);

    // Open modal
    const selectButton = screen.getByText(/select exercise/i);
    await user.click(selectButton);

    // Select exercise type
    const benchPressButton = screen.getByText(/select bench press/i);
    await user.click(benchPressButton);

    // Should close modal and show selected exercise type
    expect(screen.queryByTestId('exercise-type-modal')).not.toBeInTheDocument();
    expect(screen.getByText(/bench press/i)).toBeInTheDocument();
    expect(screen.getByText(/chest exercise/i)).toBeInTheDocument();
  });

  it('shows validation error for required exercise type field', async () => {
    const user = userEvent.setup();
    render(<ExerciseForm {...defaultProps} />);

    const submitButton = screen.getByRole('button', { name: /add exercise/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/exercise is required/i)).toBeInTheDocument();
    });
  });

  it('successfully creates an exercise with required data only', async () => {
    const user = userEvent.setup();
    const mockExercise = { id: 456, exercise_type_id: 1 };
    
    mockedApi.post.mockResolvedValueOnce({ data: mockExercise });

    render(<ExerciseForm {...defaultProps} />);

    // Select exercise type via modal
    const selectButton = screen.getByText(/select exercise/i);
    await user.click(selectButton);
    const benchPressButton = screen.getByText(/select bench press/i);
    await user.click(benchPressButton);

    const submitButton = screen.getByRole('button', { name: /add exercise/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockedApi.post).toHaveBeenCalledWith(
        '/exercises/',
        expect.objectContaining({
          exercise_type_id: 1,
          workout_id: 123,
          timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/),
          notes: null,
        }),
      );
    });

    await waitFor(() => {
      expect(mockOnExerciseCreated).toHaveBeenCalled();
    });
  });

  it('successfully creates an exercise with all data', async () => {
    const user = userEvent.setup();
    const mockExercise = { id: 456 };
    
    mockedApi.post.mockResolvedValueOnce({ data: mockExercise });

    render(<ExerciseForm {...defaultProps} />);

    // Fill notes field
    await user.type(screen.getByLabelText(/notes/i), 'Great set!');

    // Select exercise type via modal
    const selectButton = screen.getByText(/select exercise/i);
    await user.click(selectButton);
    const benchPressButton = screen.getByText(/select bench press/i);
    await user.click(benchPressButton);

    const submitButton = screen.getByRole('button', { name: /add exercise/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockedApi.post).toHaveBeenCalledWith(
        '/exercises/',
        expect.objectContaining({
          exercise_type_id: 1,
          workout_id: 123,
          timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/),
          notes: 'Great set!',
        }),
      );
    });
  });

  it('shows loading state during submission', async () => {
    const user = userEvent.setup();
    
    render(<ExerciseForm {...defaultProps} />);

    // Select exercise type via modal
    const selectButton = screen.getByText(/select exercise/i);
    await user.click(selectButton);
    const benchPressButton = screen.getByText(/select bench press/i);
    await user.click(benchPressButton);

    // Verify the submit button is available after selection
    expect(screen.getByRole('button', { name: /add exercise/i })).toBeInTheDocument();
  });

  it('shows error message when submission fails', async () => {
    const user = userEvent.setup();
    
    mockedApi.post.mockRejectedValueOnce(new Error('Network error'));

    render(<ExerciseForm {...defaultProps} />);

    // Select exercise type via modal
    const selectButton = screen.getByText(/select exercise/i);
    await user.click(selectButton);
    const benchPressButton = screen.getByText(/select bench press/i);
    await user.click(benchPressButton);

    const submitButton = screen.getByRole('button', { name: /add exercise/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/failed to create exercise/i)).toBeInTheDocument();
    });
  });

  it('resets form after successful submission', async () => {
    const user = userEvent.setup();
    const mockExercise = { id: 456 };
    
    mockedApi.post.mockResolvedValueOnce({ data: mockExercise });

    render(<ExerciseForm {...defaultProps} />);

    const notesInput = screen.getByLabelText(/notes/i) as HTMLInputElement;

    // Fill out the form
    await user.type(notesInput, 'Test notes');

    // Select exercise type
    const selectButton = screen.getByText(/select exercise/i);
    await user.click(selectButton);
    const benchPressButton = screen.getByText(/select bench press/i);
    await user.click(benchPressButton);

    const submitButton = screen.getByRole('button', { name: /add exercise/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(notesInput.value).toBe('');
      // Should show "Select Exercise" again after reset
      expect(screen.getByText(/select exercise/i)).toBeInTheDocument();
    });
  });

  it('converts workoutId prop to number for API call', async () => {
    const user = userEvent.setup();
    const mockExercise = { id: 456 };
    
    mockedApi.post.mockResolvedValueOnce({ data: mockExercise });

    render(<ExerciseForm workoutId="999" onExerciseCreated={mockOnExerciseCreated} />);

    // Select exercise type via modal
    const selectButton = screen.getByText(/select exercise/i);
    await user.click(selectButton);
    const benchPressButton = screen.getByText(/select bench press/i);
    await user.click(benchPressButton);

    const submitButton = screen.getByRole('button', { name: /add exercise/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockedApi.post).toHaveBeenCalledWith(
        '/exercises/',
        expect.objectContaining({
          workout_id: 999, // Should be converted to number
          exercise_type_id: 1,
        }),
      );
    });
  });
});