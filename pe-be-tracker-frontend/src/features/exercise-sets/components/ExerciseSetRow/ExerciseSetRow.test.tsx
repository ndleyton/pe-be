import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { render } from '@/test/utils';
import ExerciseSetRow from './ExerciseSetRow';
import { ExerciseSet } from '@/api/exercises';

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

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders exercise set data correctly', () => {
    render(
      <ExerciseSetRow
        exerciseSet={mockExerciseSet}
        onUpdate={mockOnUpdate}
        onDelete={mockOnDelete}
      />
    );

    expect(screen.getByText('10')).toBeInTheDocument(); // reps
    expect(screen.getByText('50.5')).toBeInTheDocument(); // intensity
    expect(screen.getByText('60s')).toBeInTheDocument(); // rest time
  });

  it('shows completed state when done is true', () => {
    const completedSet = { ...mockExerciseSet, done: true };
    
    render(
      <ExerciseSetRow
        exerciseSet={completedSet}
        onUpdate={mockOnUpdate}
        onDelete={mockOnDelete}
      />
    );

    // Should show mark as incomplete button when completed
    expect(screen.getByLabelText(/mark as incomplete/i)).toBeInTheDocument();
  });

  it('renders with incomplete data', () => {
    const incompleteSet = {
      ...mockExerciseSet,
      reps: null,
      intensity: null,
      rest_time_seconds: null,
    };
    
    render(
      <ExerciseSetRow
        exerciseSet={incompleteSet}
        onUpdate={mockOnUpdate}
        onDelete={mockOnDelete}
      />
    );

    // Should render without crashing and show mark as complete button
    expect(screen.getByLabelText(/mark as complete/i)).toBeInTheDocument();
  });
});