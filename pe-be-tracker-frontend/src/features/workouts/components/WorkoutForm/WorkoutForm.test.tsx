import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render } from '@/test/utils';
import WorkoutForm from './WorkoutForm';

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

vi.mock('../WorkoutTypeModal', () => ({
  default: ({ isOpen, onClose }: WorkoutTypeModalProps) => 
    isOpen ? (
      <div data-testid="workout-type-modal">
        <button onClick={onClose}>Close Modal</button>
      </div>
    ) : null,
}));

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

    expect(screen.getByText(/select workout type/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/notes/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/start time/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /start workout/i })).toBeInTheDocument();
  });

  it('opens workout type modal when clicking select workout type', async () => {
    const user = userEvent.setup();
    render(<WorkoutForm onWorkoutCreated={mockOnWorkoutCreated} />);

    const selectButton = screen.getByText(/select workout type/i);
    await user.click(selectButton);

    expect(screen.getByTestId('workout-type-modal')).toBeInTheDocument();
  });

});