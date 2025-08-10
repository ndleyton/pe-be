import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render } from '@/test/utils';
import ExerciseForm from './ExerciseForm';

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

vi.mock('../ExerciseTypeModal', () => ({
  default: ({ isOpen, onClose }: ExerciseTypeModalProps) => 
    isOpen ? (
      <div data-testid="exercise-type-modal">
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

  expect(screen.getByRole('heading', { name: /add exercise/i, level: 2 })).toBeInTheDocument();
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

  it('shows validation error for required exercise type field', async () => {
    const user = userEvent.setup();
    render(<ExerciseForm {...defaultProps} />);

    // Try to submit without selecting exercise type
    const submitButton = screen.getByRole('button', { name: /add exercise/i });
    await user.click(submitButton);

    expect(screen.getByText(/exercise is required/i)).toBeInTheDocument();
  });
});