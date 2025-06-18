import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor, fireEvent, act } from '@testing-library/react';
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
    getIntensityUnits: vi.fn(),
  };
});

const mockCreateExerciseSet = vi.mocked(exerciseApi.createExerciseSet);
const mockGetIntensityUnits = vi.mocked(exerciseApi.getIntensityUnits);

describe('AddExerciseSetForm', () => {
  const mockOnSetAdded = vi.fn();
  const mockOnCancel = vi.fn();

  const defaultProps = {
    exerciseId: 123,
    onSetAdded: mockOnSetAdded,
    onCancel: mockOnCancel,
  };

  const mockIntensityUnits = [
    { id: 1, name: 'Kilograms', abbreviation: 'kg', created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z' },
    { id: 2, name: 'Pounds', abbreviation: 'lbs', created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z' },
    { id: 3, name: 'Kilometers per hour', abbreviation: 'km/h', created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z' },
    { id: 4, name: 'Miles per hour', abbreviation: 'mph', created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z' },
    { id: 5, name: 'Bodyweight', abbreviation: 'BW', created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z' },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetIntensityUnits.mockResolvedValue(mockIntensityUnits);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders form with all fields', async () => {
    render(<AddExerciseSetForm {...defaultProps} />);

    expect(screen.getByText('Add New Set')).toBeInTheDocument();
    expect(screen.getByLabelText('Reps')).toBeInTheDocument();
    expect(screen.getByLabelText('Weight')).toBeInTheDocument();
    expect(screen.getByLabelText('Rest (seconds)')).toBeInTheDocument();
    expect(screen.getByLabelText('Mark as completed')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add Set' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    
    // Wait for intensity units to load
    await waitFor(() => {
      expect(screen.getByText('kg')).toBeInTheDocument(); // Default unit button
    });
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

  it('renders default intensity unit', async () => {
    render(<AddExerciseSetForm {...defaultProps} />);
    
    // Wait for intensity units to load
    await waitFor(() => {
      const unitButton = screen.getByLabelText(/Current unit: Kilograms/);
      expect(unitButton).toBeInTheDocument();
      expect(unitButton).toHaveTextContent('kg');
    });
  });

  it('changes intensity unit on click', async () => {
    const mockSet: ExerciseSet = {
      id: 456,
      reps: 10,
      intensity: 50.5,
      intensity_unit_id: 2, // Pounds
      exercise_id: 123,
      rest_time_seconds: 60,
      done: false,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    };

    mockCreateExerciseSet.mockResolvedValueOnce(mockSet);

    render(<AddExerciseSetForm {...defaultProps} />);

    // Wait for intensity units to load and get the unit button
    const unitButton = await screen.findByLabelText(/Current unit: Kilograms/);
    expect(unitButton).toHaveTextContent('kg');

    // Click the unit button to open selector
    fireEvent.click(unitButton);

    // Should open the unit selector
    await waitFor(() => {
      expect(screen.getByText('Select Unit:')).toBeInTheDocument();
      expect(screen.getByLabelText('Select Pounds (lbs)')).toBeInTheDocument();
    });

    // Select lbs from the pop-over
    const lbsOption = screen.getByLabelText('Select Pounds (lbs)');
    fireEvent.click(lbsOption);

    // Should close the selector and update the button
    await waitFor(() => {
      expect(screen.queryByText('Select Unit:')).not.toBeInTheDocument();
    });

    const updatedUnitButton = screen.getByLabelText(/Current unit: Pounds/);
    expect(updatedUnitButton).toHaveTextContent('lbs');

    // Fill out and submit form to verify intensity_unit_id is updated
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Reps'), '10');
    await user.type(screen.getByLabelText('Weight'), '50.5');
    await user.type(screen.getByLabelText('Rest (seconds)'), '60');

    const submitButton = screen.getByRole('button', { name: 'Add Set' });
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockCreateExerciseSet).toHaveBeenCalledWith({
        exercise_id: 123,
        intensity_unit_id: 2, // Should be lbs (id: 2)
        reps: 10,
        intensity: 50.5,
        rest_time_seconds: 60,
        done: false,
      });
      expect(mockOnSetAdded).toHaveBeenCalledWith(mockSet);
    });
  });

  it('cancels unit selection when cancel button is clicked', async () => {
    render(<AddExerciseSetForm {...defaultProps} />);

    // Wait for intensity units to load and get the unit button
    const unitButton = await screen.findByLabelText(/Current unit: Kilograms/);
    
    // Click to open selector
    fireEvent.click(unitButton);

    await waitFor(() => {
      expect(screen.getByText('Select Unit:')).toBeInTheDocument();
    });

    // Click cancel
    const cancelButton = screen.getByLabelText('Cancel unit selection');
    fireEvent.click(cancelButton);

    // Should close the selector
    await waitFor(() => {
      expect(screen.queryByText('Select Unit:')).not.toBeInTheDocument();
    });

    // Unit should remain kg
    expect(screen.getByLabelText(/Current unit: Kilograms/)).toHaveTextContent('kg');
  });


  it('resets unit to default after successful submission', async () => {
    const mockSet: ExerciseSet = {
      id: 456,
      reps: 10,
      intensity: 50.5,
      intensity_unit_id: 2, // Pounds
      exercise_id: 123,
      rest_time_seconds: 60,
      done: false,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    };

    mockCreateExerciseSet.mockResolvedValueOnce(mockSet);

    render(<AddExerciseSetForm {...defaultProps} />);

    // Wait for intensity units to load and get the unit button
    const unitButton = await screen.findByLabelText(/Current unit: Kilograms/);
    
    // Click to change unit to lbs
    fireEvent.click(unitButton);

    await waitFor(() => {
      expect(screen.getByText('Select Unit:')).toBeInTheDocument();
    });

    const lbsOption = screen.getByLabelText('Select Pounds (lbs)');
    fireEvent.click(lbsOption);

    // Verify unit changed
    await waitFor(() => {
      expect(screen.getByLabelText(/Current unit: Pounds/)).toHaveTextContent('lbs');
    });

    // Fill and submit form
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Reps'), '10');
    await user.type(screen.getByLabelText('Weight'), '50.5');
    await user.type(screen.getByLabelText('Rest (seconds)'), '60');

    const submitButton = screen.getByRole('button', { name: 'Add Set' });
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockOnSetAdded).toHaveBeenCalled();
    });

    // Unit should reset to default (kg)
    expect(screen.getByLabelText(/Current unit: Kilograms/)).toHaveTextContent('kg');
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