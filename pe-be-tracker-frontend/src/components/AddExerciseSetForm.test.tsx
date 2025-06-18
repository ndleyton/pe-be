import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render } from '../test/utils';
import AddExerciseSetForm from './AddExerciseSetForm';
import { ExerciseSet } from '../api/exercises';
import * as exerciseApi from '../api/exercises';

vi.mock('../api/exercises', async () => {
  const actual = await vi.importActual('../api/exercises');
  return {
    ...actual,
    createExerciseSet: vi.fn(),
  };
});

const mockCreateExerciseSet = vi.mocked(exerciseApi.createExerciseSet);

describe('AddExerciseSetForm', () => {
  const mockOnSetAdded = vi.fn();
  const mockOnCancel = vi.fn();

  const defaultProps = {
    exerciseId: 123,
    onSetAdded: mockOnSetAdded,
    onCancel: mockOnCancel,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders form with all fields', () => {
    render(<AddExerciseSetForm {...defaultProps} />);

    expect(screen.getByText('Add New Set')).toBeInTheDocument();
    expect(screen.getByLabelText('Reps')).toBeInTheDocument();
    expect(screen.getByLabelText('Weight')).toBeInTheDocument();
    expect(screen.getByLabelText('Rest (seconds)')).toBeInTheDocument();
    expect(screen.getByLabelText('Mark as completed')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add Set' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('has correct placeholders and initial values', () => {
    render(<AddExerciseSetForm {...defaultProps} />);

    expect(screen.getByPlaceholderText('e.g., 10')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('e.g., 50.5')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('e.g., 60')).toBeInTheDocument();
    
    const checkbox = screen.getByLabelText('Mark as completed') as HTMLInputElement;
    expect(checkbox.checked).toBe(false);
  });

  it('submits form with valid data', async () => {
    const user = userEvent.setup();
    const mockSet: ExerciseSet = {
      id: 456,
      reps: 10,
      intensity: 50.5,
      intensity_unit_id: 1,
      exercise_id: 123,
      rest_time_seconds: 60,
      done: false,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    };

    mockCreateExerciseSet.mockResolvedValueOnce(mockSet);

    render(<AddExerciseSetForm {...defaultProps} />);

    // Fill out form
    await user.type(screen.getByLabelText('Reps'), '10');
    await user.type(screen.getByLabelText('Weight'), '50.5');
    await user.type(screen.getByLabelText('Rest (seconds)'), '60');

    // Submit form
    const submitButton = screen.getByRole('button', { name: 'Add Set' });
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockCreateExerciseSet).toHaveBeenCalledWith({
        exercise_id: 123,
        intensity_unit_id: 1,
        reps: 10,
        intensity: 50.5,
        rest_time_seconds: 60,
        done: false,
      });
      expect(mockOnSetAdded).toHaveBeenCalledWith(mockSet);
    });
  });

  it('submits form with minimal data', async () => {
    const user = userEvent.setup();
    const mockSet: ExerciseSet = {
      id: 456,
      reps: null,
      intensity: null,
      intensity_unit_id: 1,
      exercise_id: 123,
      rest_time_seconds: null,
      done: false,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    };

    mockCreateExerciseSet.mockResolvedValueOnce(mockSet);

    render(<AddExerciseSetForm {...defaultProps} />);

    // Submit form without filling any fields
    const submitButton = screen.getByRole('button', { name: 'Add Set' });
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockCreateExerciseSet).toHaveBeenCalledWith({
        exercise_id: 123,
        intensity_unit_id: 1,
        reps: undefined,
        intensity: undefined,
        rest_time_seconds: undefined,
        done: false,
      });
      expect(mockOnSetAdded).toHaveBeenCalledWith(mockSet);
    });
  });

  it('handles checkbox for done status', async () => {
    const user = userEvent.setup();
    const mockSet: ExerciseSet = {
      id: 456,
      reps: 10,
      intensity: 50.5,
      intensity_unit_id: 1,
      exercise_id: 123,
      rest_time_seconds: 60,
      done: true,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    };

    mockCreateExerciseSet.mockResolvedValueOnce(mockSet);

    render(<AddExerciseSetForm {...defaultProps} />);

    // Fill form and check "done" checkbox
    await user.type(screen.getByLabelText('Reps'), '10');
    await user.type(screen.getByLabelText('Weight'), '50.5');
    await user.type(screen.getByLabelText('Rest (seconds)'), '60');
    await user.click(screen.getByLabelText('Mark as completed'));

    const submitButton = screen.getByRole('button', { name: 'Add Set' });
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockCreateExerciseSet).toHaveBeenCalledWith({
        exercise_id: 123,
        intensity_unit_id: 1,
        reps: 10,
        intensity: 50.5,
        rest_time_seconds: 60,
        done: true,
      });
    });
  });

  it('resets form after successful submission', async () => {
    const user = userEvent.setup();
    const mockSet: ExerciseSet = {
      id: 456,
      reps: 10,
      intensity: 50.5,
      intensity_unit_id: 1,
      exercise_id: 123,
      rest_time_seconds: 60,
      done: false,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    };

    mockCreateExerciseSet.mockResolvedValueOnce(mockSet);

    render(<AddExerciseSetForm {...defaultProps} />);

    // Fill form
    const repsInput = screen.getByLabelText('Reps') as HTMLInputElement;
    const weightInput = screen.getByLabelText('Weight') as HTMLInputElement;
    const restInput = screen.getByLabelText('Rest (seconds)') as HTMLInputElement;
    const doneCheckbox = screen.getByLabelText('Mark as completed') as HTMLInputElement;

    await user.type(repsInput, '10');
    await user.type(weightInput, '50.5');
    await user.type(restInput, '60');
    await user.click(doneCheckbox);

    // Submit form
    const submitButton = screen.getByRole('button', { name: 'Add Set' });
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockOnSetAdded).toHaveBeenCalled();
    });

    // Form should be reset
    expect(repsInput.value).toBe('');
    expect(weightInput.value).toBe('');
    expect(restInput.value).toBe('');
    expect(doneCheckbox.checked).toBe(false);
  });

  it('shows loading state during submission', async () => {
    const user = userEvent.setup();
    mockCreateExerciseSet.mockImplementation(() => new Promise(() => {})); // Never resolves

    render(<AddExerciseSetForm {...defaultProps} />);

    const submitButton = screen.getByRole('button', { name: 'Add Set' });
    await user.click(submitButton);

    expect(screen.getByText('Adding...')).toBeInTheDocument();
    expect(submitButton).toBeDisabled();
  });

  it('calls onCancel when cancel button is clicked', async () => {
    const user = userEvent.setup();
    render(<AddExerciseSetForm {...defaultProps} />);

    const cancelButton = screen.getByRole('button', { name: 'Cancel' });
    await user.click(cancelButton);

    expect(mockOnCancel).toHaveBeenCalled();
  });

  it('handles API errors gracefully', async () => {
    const user = userEvent.setup();
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockCreateExerciseSet.mockRejectedValueOnce(new Error('API Error'));

    render(<AddExerciseSetForm {...defaultProps} />);

    const submitButton = screen.getByRole('button', { name: 'Add Set' });
    await user.click(submitButton);

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith('Error creating exercise set:', expect.any(Error));
    });

    // Should exit loading state
    expect(screen.queryByText('Adding...')).not.toBeInTheDocument();
    expect(submitButton).not.toBeDisabled();

    consoleSpy.mockRestore();
  });

  it.skip('handles decimal values correctly', async () => {
    const mockSet: ExerciseSet = {
      id: 456,
      reps: 10,
      intensity: 50.75,
      intensity_unit_id: 1,
      exercise_id: 123,
      rest_time_seconds: 90,
      done: false,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    };

    mockCreateExerciseSet.mockResolvedValueOnce(mockSet);

    render(<AddExerciseSetForm {...defaultProps} />);

    // Fill form with decimal weight using fireEvent for more direct control
    const repsInput = screen.getByLabelText('Reps');
    const weightInput = screen.getByLabelText('Weight');
    const restInput = screen.getByLabelText('Rest (seconds)');

    fireEvent.change(repsInput, { target: { value: '10' } });
    fireEvent.change(weightInput, { target: { value: '50.75' } });
    fireEvent.change(restInput, { target: { value: '90' } });

    const submitButton = screen.getByRole('button', { name: 'Add Set' });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockCreateExerciseSet).toHaveBeenCalledWith({
        exercise_id: 123,
        intensity_unit_id: 1,
        reps: 10,
        intensity: 50.75,
        rest_time_seconds: 90,
        done: false,
      });
      expect(mockOnSetAdded).toHaveBeenCalledWith(mockSet);
    });
  });
});