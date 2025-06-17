import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render } from '../test/utils';
import ExerciseSetRow from './ExerciseSetRow';
import { ExerciseSet } from '../api/exercises';
import * as exerciseApi from '../api/exercises';

vi.mock('../api/exercises', async () => {
  const actual = await vi.importActual('../api/exercises');
  return {
    ...actual,
    updateExerciseSet: vi.fn(),
    deleteExerciseSet: vi.fn(),
  };
});

const mockUpdateExerciseSet = vi.mocked(exerciseApi.updateExerciseSet);
const mockDeleteExerciseSet = vi.mocked(exerciseApi.deleteExerciseSet);

describe('ExerciseSetRow', () => {
  const mockExerciseSet: ExerciseSet = {
    id: 1,
    reps: 10,
    intensity: 50.5,
    intensity_unit_id: 1,
    exercise_id: 1,
    rest_time_seconds: 60,
    done: false,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  };

  const mockOnUpdate = vi.fn();
  const mockOnDelete = vi.fn();

  const defaultProps = {
    exerciseSet: mockExerciseSet,
    onUpdate: mockOnUpdate,
    onDelete: mockOnDelete,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders exercise set data correctly', () => {
    render(<ExerciseSetRow {...defaultProps} />);

    expect(screen.getByText('Reps:')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('Weight:')).toBeInTheDocument();
    expect(screen.getByText('50.5')).toBeInTheDocument();
    expect(screen.getByText('Rest:')).toBeInTheDocument();
    expect(screen.getByText('60s')).toBeInTheDocument();
    expect(screen.getByText('Edit')).toBeInTheDocument();
    expect(screen.getByText('Delete')).toBeInTheDocument();
  });

  it('renders with incomplete data', () => {
    const incompleteSet: ExerciseSet = {
      ...mockExerciseSet,
      reps: null,
      intensity: null,
      rest_time_seconds: null,
    };

    render(<ExerciseSetRow {...defaultProps} exerciseSet={incompleteSet} />);

    expect(screen.getByText('Reps:')).toBeInTheDocument();
    expect(screen.getByText('-')).toBeInTheDocument();
    expect(screen.getByText('Weight:')).toBeInTheDocument();
    expect(screen.queryByText('Rest:')).not.toBeInTheDocument();
  });

  it('shows completed state when done is true', () => {
    const completedSet: ExerciseSet = {
      ...mockExerciseSet,
      done: true,
    };

    render(<ExerciseSetRow {...defaultProps} exerciseSet={completedSet} />);

    const checkbox = screen.getByRole('button');
    expect(checkbox).toHaveClass('bg-green-600');
    expect(screen.getByText('✓')).toBeInTheDocument();
  });

  it('toggles done status when checkbox is clicked', async () => {
    const user = userEvent.setup();
    const updatedSet = { ...mockExerciseSet, done: true };
    mockUpdateExerciseSet.mockResolvedValueOnce(updatedSet);

    render(<ExerciseSetRow {...defaultProps} />);

    const checkbox = screen.getByRole('button');
    await user.click(checkbox);

    await waitFor(() => {
      expect(mockUpdateExerciseSet).toHaveBeenCalledWith(1, { done: true });
      expect(mockOnUpdate).toHaveBeenCalledWith(updatedSet);
    });
  });

  it('enters edit mode when edit button is clicked', async () => {
    const user = userEvent.setup();
    render(<ExerciseSetRow {...defaultProps} />);

    const editButton = screen.getByText('Edit');
    await user.click(editButton);

    expect(screen.getByDisplayValue('10')).toBeInTheDocument(); // reps input
    expect(screen.getByDisplayValue('50.5')).toBeInTheDocument(); // intensity input
    expect(screen.getByDisplayValue('60')).toBeInTheDocument(); // rest time input
    expect(screen.getByText('Save')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  it('saves changes when save button is clicked in edit mode', async () => {
    const user = userEvent.setup();
    const updatedSet = { ...mockExerciseSet, reps: 12, intensity: 55.0 };
    mockUpdateExerciseSet.mockResolvedValueOnce(updatedSet);

    render(<ExerciseSetRow {...defaultProps} />);

    // Enter edit mode
    const editButton = screen.getByText('Edit');
    await user.click(editButton);

    // Update values
    const repsInput = screen.getByDisplayValue('10');
    const intensityInput = screen.getByDisplayValue('50.5');
    
    await user.clear(repsInput);
    await user.type(repsInput, '12');
    await user.clear(intensityInput);
    await user.type(intensityInput, '55');

    // Save changes
    const saveButton = screen.getByText('Save');
    await user.click(saveButton);

    await waitFor(() => {
      expect(mockUpdateExerciseSet).toHaveBeenCalledWith(1, {
        reps: 12,
        intensity: 55,
        rest_time_seconds: 60,
        done: false,
      });
      expect(mockOnUpdate).toHaveBeenCalledWith(updatedSet);
    });

    // Should exit edit mode
    expect(screen.queryByText('Save')).not.toBeInTheDocument();
    expect(screen.getByText('Edit')).toBeInTheDocument();
  });

  it('cancels edit mode when cancel button is clicked', async () => {
    const user = userEvent.setup();
    render(<ExerciseSetRow {...defaultProps} />);

    // Enter edit mode
    const editButton = screen.getByText('Edit');
    await user.click(editButton);

    // Cancel editing
    const cancelButton = screen.getByText('Cancel');
    await user.click(cancelButton);

    // Should exit edit mode without saving
    expect(screen.queryByText('Save')).not.toBeInTheDocument();
    expect(screen.getByText('Edit')).toBeInTheDocument();
    expect(mockUpdateExerciseSet).not.toHaveBeenCalled();
  });

  it('confirms deletion before deleting', async () => {
    const user = userEvent.setup();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    mockDeleteExerciseSet.mockResolvedValueOnce();

    render(<ExerciseSetRow {...defaultProps} />);

    const deleteButton = screen.getByText('Delete');
    await user.click(deleteButton);

    expect(confirmSpy).toHaveBeenCalledWith('Are you sure you want to delete this set?');
    
    await waitFor(() => {
      expect(mockDeleteExerciseSet).toHaveBeenCalledWith(1);
      expect(mockOnDelete).toHaveBeenCalledWith(1);
    });

    confirmSpy.mockRestore();
  });

  it('does not delete when confirmation is cancelled', async () => {
    const user = userEvent.setup();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);

    render(<ExerciseSetRow {...defaultProps} />);

    const deleteButton = screen.getByText('Delete');
    await user.click(deleteButton);

    expect(confirmSpy).toHaveBeenCalled();
    expect(mockDeleteExerciseSet).not.toHaveBeenCalled();
    expect(mockOnDelete).not.toHaveBeenCalled();

    confirmSpy.mockRestore();
  });

  it('handles API errors gracefully', async () => {
    const user = userEvent.setup();
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockUpdateExerciseSet.mockRejectedValueOnce(new Error('API Error'));

    render(<ExerciseSetRow {...defaultProps} />);

    const checkbox = screen.getByRole('button');
    await user.click(checkbox);

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith('Error toggling done status:', expect.any(Error));
    });

    consoleSpy.mockRestore();
  });
});