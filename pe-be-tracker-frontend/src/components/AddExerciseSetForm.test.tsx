import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen } from '@testing-library/react';
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
});