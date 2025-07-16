import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render } from '@/test/utils';
import ExerciseRow from './ExerciseRow';
import { Exercise, ExerciseSet } from '@/api/exercises';

// Mock the child components
vi.mock('../../../exercise-sets/components/ExerciseSetRow', () => ({
  default: ({ exerciseSet, onUpdate, onDelete }: any) => (
    <div data-testid={`exercise-set-${exerciseSet.id}`}>
      <span>Set {exerciseSet.id}: {exerciseSet.reps} reps</span>
      <button onClick={() => onUpdate({ ...exerciseSet, reps: exerciseSet.reps + 1 })}>
        Update Set
      </button>
      <button onClick={() => onDelete(exerciseSet.id)}>Delete Set</button>
    </div>
  ),
}));

vi.mock('../../../exercise-sets/components/AddExerciseSetForm', () => ({
  default: ({ exerciseId, onSetAdded, onCancel }: any) => (
    <div data-testid="add-exercise-set-form">
      <span>Add set form for exercise {exerciseId}</span>
      <button onClick={() => onSetAdded({ id: 999, reps: 5, exercise_id: exerciseId })}>
        Add Mock Set
      </button>
      <button onClick={onCancel}>Cancel Form</button>
    </div>
  ),
}));

describe('ExerciseRow', () => {
  const mockExerciseSet1: ExerciseSet = {
    id: 1,
    reps: 10,
    intensity: 50.5,
    intensity_unit_id: 1,
    exercise_id: 123,
    rest_time_seconds: 60,
    done: false,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  };

  const mockExerciseSet2: ExerciseSet = {
    id: 2,
    reps: 12,
    intensity: 55.0,
    intensity_unit_id: 1,
    exercise_id: 123,
    rest_time_seconds: 90,
    done: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  };

  const mockExercise: Exercise = {
    id: 123,
    timestamp: '2024-01-01T10:00:00Z',
    notes: 'Great workout!',
    exercise_type_id: 1,
    workout_id: 456,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    exercise_type: {
      id: 1,
      name: 'Bench Press',
      description: 'Chest exercise',
      default_intensity_unit: 1,
      times_used: 5,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
      muscle_groups: ['chest'],
      equipment: 'barbell',
      usage_count: 5,
    },
    exercise_sets: [mockExerciseSet1, mockExerciseSet2],
  };

  const mockOnExerciseUpdate = vi.fn();

  const defaultProps = {
    exercise: mockExercise,
    onExerciseUpdate: mockOnExerciseUpdate,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders exercise information correctly', () => {
    render(<ExerciseRow {...defaultProps} />);

    expect(screen.getByText('Bench Press')).toBeInTheDocument();
    expect(screen.getByText('Chest exercise')).toBeInTheDocument();
    expect(screen.getByText('Great workout!')).toBeInTheDocument();
    expect(screen.getByText('B')).toBeInTheDocument(); // First letter of exercise name
  });

  it('displays timestamp when available', () => {
    render(<ExerciseRow {...defaultProps} />);

    expect(screen.getByText(new Date('2024-01-01T10:00:00Z').toLocaleString())).toBeInTheDocument();
  });

  it('displays created date when timestamp is not available', () => {
    const exerciseWithoutTimestamp = {
      ...mockExercise,
      timestamp: null,
    };

    render(<ExerciseRow exercise={exerciseWithoutTimestamp} onExerciseUpdate={mockOnExerciseUpdate} />);

    expect(screen.getByText(/Created:/)).toBeInTheDocument();
    expect(screen.getByText(new RegExp(new Date('2024-01-01T00:00:00Z').toLocaleString()))).toBeInTheDocument();
  });

  it('shows add set button', () => {
    render(<ExerciseRow {...defaultProps} />);

    const addButton = screen.getByTitle('Add set');
    expect(addButton).toBeInTheDocument();
    expect(addButton).toHaveTextContent('+');
  });

  it('shows expand/collapse button when exercise has sets', () => {
    render(<ExerciseRow {...defaultProps} />);

    expect(screen.getByText('▼ 2 sets')).toBeInTheDocument();
  });

  it('does not show expand button when exercise has no sets', () => {
    const exerciseWithoutSets = {
      ...mockExercise,
      exercise_sets: [],
    };

    render(<ExerciseRow exercise={exerciseWithoutSets} onExerciseUpdate={mockOnExerciseUpdate} />);

    expect(screen.queryByText(/sets/)).not.toBeInTheDocument();
    expect(screen.queryByText('▼')).not.toBeInTheDocument();
  });

  it('expands to show exercise sets when expand button is clicked', async () => {
    const user = userEvent.setup();
    render(<ExerciseRow {...defaultProps} />);

    const expandButton = screen.getByText('▼ 2 sets');
    await user.click(expandButton);

    expect(screen.getByText('▲')).toBeInTheDocument();
    expect(screen.getByText('Sets (2)')).toBeInTheDocument();
    expect(screen.getByTestId('exercise-set-1')).toBeInTheDocument();
    expect(screen.getByTestId('exercise-set-2')).toBeInTheDocument();
  });

  it('shows add set form when add button is clicked', async () => {
    const user = userEvent.setup();
    render(<ExerciseRow {...defaultProps} />);

    const addButton = screen.getByTitle('Add set');
    await user.click(addButton);

    expect(screen.getByTestId('add-exercise-set-form')).toBeInTheDocument();
    expect(screen.getByText('Add set form for exercise 123')).toBeInTheDocument();
  });

  it('handles adding a new set', async () => {
    const user = userEvent.setup();
    render(<ExerciseRow {...defaultProps} />);

    // Open add form
    const addButton = screen.getByTitle('Add set');
    await user.click(addButton);

    // Add a set
    const addMockSetButton = screen.getByText('Add Mock Set');
    await user.click(addMockSetButton);

    expect(mockOnExerciseUpdate).toHaveBeenCalledWith({
      ...mockExercise,
      exercise_sets: [
        ...mockExercise.exercise_sets,
        { id: 999, reps: 5, exercise_id: 123 },
      ],
    });

    // Form should be hidden after adding
    expect(screen.queryByTestId('add-exercise-set-form')).not.toBeInTheDocument();
  });

  it('handles canceling add set form', async () => {
    const user = userEvent.setup();
    render(<ExerciseRow {...defaultProps} />);

    // Open add form
    const addButton = screen.getByTitle('Add set');
    await user.click(addButton);

    // Cancel form
    const cancelButton = screen.getByText('Cancel Form');
    await user.click(cancelButton);

    expect(screen.queryByTestId('add-exercise-set-form')).not.toBeInTheDocument();
  });

  it('handles updating an exercise set', async () => {
    const user = userEvent.setup();
    render(<ExerciseRow {...defaultProps} />);

    // Expand to show sets
    const expandButton = screen.getByText('▼ 2 sets');
    await user.click(expandButton);

    // Update a set
    const updateButton = screen.getAllByText('Update Set')[0];
    await user.click(updateButton);

    expect(mockOnExerciseUpdate).toHaveBeenCalledWith({
      ...mockExercise,
      exercise_sets: [
        { ...mockExerciseSet1, reps: 11 }, // Updated set
        mockExerciseSet2,
      ],
    });
  });

  it('handles deleting an exercise set', async () => {
    const user = userEvent.setup();
    render(<ExerciseRow {...defaultProps} />);

    // Expand to show sets
    const expandButton = screen.getByText('▼ 2 sets');
    await user.click(expandButton);

    // Delete a set
    const deleteButton = screen.getAllByText('Delete Set')[0];
    await user.click(deleteButton);

    expect(mockOnExerciseUpdate).toHaveBeenCalledWith({
      ...mockExercise,
      exercise_sets: [mockExerciseSet2], // First set removed
    });
  });

  it('shows empty state when expanded but no sets exist', async () => {
    const user = userEvent.setup();
    const exerciseWithoutSets = {
      ...mockExercise,
      exercise_sets: [],
    };

    render(<ExerciseRow exercise={exerciseWithoutSets} onExerciseUpdate={mockOnExerciseUpdate} />);

    // Add a set first to trigger expand functionality, then delete all sets
    const addButton = screen.getByTitle('Add set');
    await user.click(addButton);
    
    // Since there are no sets initially, we need to add one first
    const addMockSetButton = screen.getByText('Add Mock Set');
    await user.click(addMockSetButton);

    // Now expand (there should be 1 set now)
    const expandButton = screen.getByText('▼ 1 sets');
    await user.click(expandButton);

    // Delete the set
    const deleteButton = screen.getByText('Delete Set');
    await user.click(deleteButton);

    // Should show empty state
    expect(screen.getByText('No sets added yet. Click the + button to add your first set.')).toBeInTheDocument();
  });

  it('works without onExerciseUpdate callback', () => {
    render(<ExerciseRow exercise={mockExercise} />);

    expect(screen.getByText('Bench Press')).toBeInTheDocument();
    expect(screen.getByTitle('Add set')).toBeInTheDocument();
  });

  it('handles exercise without notes gracefully', () => {
    const exerciseWithoutNotes = {
      ...mockExercise,
      notes: null,
    };

    render(<ExerciseRow exercise={exerciseWithoutNotes} onExerciseUpdate={mockOnExerciseUpdate} />);

    expect(screen.getByText('Bench Press')).toBeInTheDocument();
    expect(screen.queryByText('Great workout!')).not.toBeInTheDocument();
  });

  it('handles exercise type without description gracefully', () => {
    const exerciseWithoutDescription = {
      ...mockExercise,
      exercise_type: {
        ...mockExercise.exercise_type,
        description: null,
      },
    };

    render(<ExerciseRow exercise={exerciseWithoutDescription} onExerciseUpdate={mockOnExerciseUpdate} />);

    expect(screen.getByText('Bench Press')).toBeInTheDocument();
    expect(screen.queryByText('Chest exercise')).not.toBeInTheDocument();
  });
});