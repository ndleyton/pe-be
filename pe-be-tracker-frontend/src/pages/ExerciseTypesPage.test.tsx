import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render } from '../test/utils';
import ExerciseTypesPage from './ExerciseTypesPage';
import { getExerciseTypes } from '@/api/exercises';
import type { ExerciseType } from '@/features/exercises/types';

vi.mock('@/api/exercises');
vi.mock('@/features/exercises/components', () => ({
  ExerciseTypeCard: ({ exerciseType }: { exerciseType: ExerciseType }) => (
    <div data-testid={`exercise-type-${exerciseType.id}`}>
      {exerciseType.name}
    </div>
  ),
}));

const mockGetExerciseTypes = vi.mocked(getExerciseTypes);

const mockExerciseTypes: ExerciseType[] = [
  {
    id: 1,
    name: 'Push-ups',
    description: 'Classic bodyweight exercise',
    muscle_groups: ['chest', 'triceps'],
    equipment: null,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    usage_count: 10,
    default_intensity_unit: 1,
    times_used: 10,
  },
  {
    id: 2,
    name: 'Squats',
    description: 'Lower body exercise',
    muscle_groups: ['quadriceps', 'glutes'],
    equipment: null,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    usage_count: 8,
    default_intensity_unit: 1,
    times_used: 8,
  },
  {
    id: 3,
    name: 'Pull-ups',
    description: 'Upper body pulling exercise',
    muscle_groups: ['back', 'biceps'],
    equipment: 'pull-up bar',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    usage_count: 6,
    default_intensity_unit: 1,
    times_used: 6,
  },
];

describe('ExerciseTypesPage - Infinite Scroll', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetExerciseTypes.mockResolvedValue({ data: mockExerciseTypes, next_cursor: null });
  });

  it('renders the page title and search controls', async () => {
    render(<ExerciseTypesPage />);

    expect(screen.getByRole('heading', { name: /exercise types/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/search exercise types/i)).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('calls getExerciseTypes with default parameters on initial load', async () => {
    render(<ExerciseTypesPage />);

    await waitFor(() => {
      expect(mockGetExerciseTypes).toHaveBeenCalledWith('usage', null, 100);
    });
  });

  it('displays exercise types after loading', async () => {
    render(<ExerciseTypesPage />);

    await waitFor(() => {
      expect(screen.getByTestId('exercise-type-1')).toBeInTheDocument();
      expect(screen.getByTestId('exercise-type-2')).toBeInTheDocument();
      expect(screen.getByTestId('exercise-type-3')).toBeInTheDocument();
    });

    expect(screen.getByText('Push-ups')).toBeInTheDocument();
    expect(screen.getByText('Squats')).toBeInTheDocument();
    expect(screen.getByText('Pull-ups')).toBeInTheDocument();
  });

  it('shows loading spinner during initial load', () => {
    mockGetExerciseTypes.mockImplementation(() => new Promise(() => {})); // Never resolves
    render(<ExerciseTypesPage />);

    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('filters exercise types based on search term', async () => {
    render(<ExerciseTypesPage />);

    await waitFor(() => {
      expect(screen.getByTestId('exercise-type-1')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/search exercise types/i);
    await userEvent.type(searchInput, 'push');

    // Should only show Push-ups
    expect(screen.getByTestId('exercise-type-1')).toBeInTheDocument();
    expect(screen.queryByTestId('exercise-type-2')).not.toBeInTheDocument();
    expect(screen.queryByTestId('exercise-type-3')).not.toBeInTheDocument();
  });

  it('filters exercise types based on description', async () => {
    render(<ExerciseTypesPage />);

    await waitFor(() => {
      expect(screen.getByTestId('exercise-type-1')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/search exercise types/i);
    await userEvent.type(searchInput, 'bodyweight');

    // Should only show Push-ups (has "bodyweight" in description)
    expect(screen.getByTestId('exercise-type-1')).toBeInTheDocument();
    expect(screen.queryByTestId('exercise-type-2')).not.toBeInTheDocument();
    expect(screen.queryByTestId('exercise-type-3')).not.toBeInTheDocument();
  });

  it('shows empty state when no exercise types match search', async () => {
    render(<ExerciseTypesPage />);

    await waitFor(() => {
      expect(screen.getByTestId('exercise-type-1')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/search exercise types/i);
    await userEvent.type(searchInput, 'nonexistent');

    expect(screen.getByText(/no exercise types found matching your search/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /clear search/i })).toBeInTheDocument();
  });

  it('clears search when clear button is clicked', async () => {
    render(<ExerciseTypesPage />);

    await waitFor(() => {
      expect(screen.getByTestId('exercise-type-1')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/search exercise types/i);
    await userEvent.type(searchInput, 'nonexistent');

    expect(screen.getByText(/no exercise types found matching your search/i)).toBeInTheDocument();

    const clearButton = screen.getByRole('button', { name: /clear search/i });
    await userEvent.click(clearButton);

    expect(searchInput).toHaveValue('');
    expect(screen.getByTestId('exercise-type-1')).toBeInTheDocument();
    expect(screen.getByTestId('exercise-type-2')).toBeInTheDocument();
    expect(screen.getByTestId('exercise-type-3')).toBeInTheDocument();
  });


  it('shows loading more indicator when fetching next page', async () => {
    // Mock first call returning full page, second call for next page
    const fullPage = Array.from({ length: 100 }, (_, i) => ({
      id: i + 1,
      name: `Exercise ${i + 1}`,
      description: `Description ${i + 1}`,
      muscle_groups: ['test'],
      equipment: null,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
      usage_count: i + 1,
      default_intensity_unit: 1,
      times_used: i + 1,
    }));

    mockGetExerciseTypes
      .mockResolvedValueOnce({ data: fullPage, next_cursor: 100 })
      .mockImplementation(() => new Promise(() => {})); // Pending next page

    render(<ExerciseTypesPage />);

    await waitFor(() => {
      expect(screen.getByTestId('exercise-type-1')).toBeInTheDocument();
    });

    // Simulate scroll to trigger next page
    Object.defineProperty(document.documentElement, 'scrollTop', {
      value: 900,
      configurable: true,
    });
    Object.defineProperty(document.documentElement, 'scrollHeight', {
      value: 1000,
      configurable: true,
    });
    Object.defineProperty(window, 'innerHeight', {
      value: 800,
      configurable: true,
    });

    fireEvent.scroll(window);

    // Should show loading more indicator
    await waitFor(() => {
      expect(screen.getByText(/loading/i)).toBeInTheDocument();
    });
  });

  it('shows no more items message when all data is loaded', async () => {
    // Mock API to return less than limit (indicating end of data)
    const partialPage = mockExerciseTypes.slice(0, 2);
    mockGetExerciseTypes.mockResolvedValue({ data: partialPage, next_cursor: null });

    render(<ExerciseTypesPage />);

    await waitFor(() => {
      expect(screen.getByTestId('exercise-type-1')).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText(/no more exercise types to load/i)).toBeInTheDocument();
    });
  });

  it('shows error message when API call fails', async () => {
    mockGetExerciseTypes.mockRejectedValue(new Error('API Error'));

    render(<ExerciseTypesPage />);

    await waitFor(() => {
      expect(screen.getByText(/error loading exercise types/i)).toBeInTheDocument();
      expect(screen.getByText(/please try again/i)).toBeInTheDocument();
    });
  });

  it('shows empty state when no exercise types exist', async () => {
    mockGetExerciseTypes.mockResolvedValue({ data: [], next_cursor: null });

    render(<ExerciseTypesPage />);

    await waitFor(() => {
      expect(screen.getByText(/no exercise types available/i)).toBeInTheDocument();
    });
  });

  it('handles case-insensitive search', async () => {
    render(<ExerciseTypesPage />);

    await waitFor(() => {
      expect(screen.getByTestId('exercise-type-1')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/search exercise types/i);
    await userEvent.type(searchInput, 'PUSH');

    // Should still find Push-ups despite case difference
    expect(screen.getByTestId('exercise-type-1')).toBeInTheDocument();
    expect(screen.queryByTestId('exercise-type-2')).not.toBeInTheDocument();
  });

  it('maintains infinite scroll functionality with filtering', async () => {
    const manyExerciseTypes = Array.from({ length: 200 }, (_, i) => ({
      id: i + 1,
      name: i < 100 ? `Push Exercise ${i + 1}` : `Pull Exercise ${i + 1}`,
      description: `Description ${i + 1}`,
      muscle_groups: ['test'],
      equipment: null,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
      usage_count: i + 1,
      default_intensity_unit: 1,
      times_used: i + 1,
    }));

    mockGetExerciseTypes.mockResolvedValue({ data: manyExerciseTypes, next_cursor: null });

    render(<ExerciseTypesPage />);

    await waitFor(() => {
      expect(screen.getByTestId('exercise-type-1')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/search exercise types/i);
    await userEvent.type(searchInput, 'Push');

    // Should show only Push exercises (filtered client-side)
    const pushExercises = screen.getAllByText(/Push Exercise/);
    expect(pushExercises).toHaveLength(100);
  });
});