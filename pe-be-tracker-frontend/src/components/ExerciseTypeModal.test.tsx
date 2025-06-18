import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import api from '../api/client';
import ExerciseTypeModal from './ExerciseTypeModal';

vi.mock('../api/client');
const mockedApi = vi.mocked(api, true);

const exerciseTypes = [
  { id: 1, name: 'Bench Press', description: 'Chest exercise', default_intensity_unit: 1, times_used: 5, created_at: '2024-01-01', updated_at: '2024-01-01' },
  { id: 2, name: 'Squat', description: 'Leg exercise', default_intensity_unit: 1, times_used: 3, created_at: '2024-01-01', updated_at: '2024-01-01' },
  { id: 3, name: 'Deadlift', description: 'Full body exercise', default_intensity_unit: 1, times_used: 2, created_at: '2024-01-01', updated_at: '2024-01-01' },
];

const renderWithQueryClient = (component: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      {component}
    </QueryClientProvider>
  );
};

describe('ExerciseTypeModal', () => {
  const mockOnClose = vi.fn();
  const mockOnSelect = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not render when closed', () => {
    renderWithQueryClient(
      <ExerciseTypeModal
        isOpen={false}
        onClose={mockOnClose}
        onSelect={mockOnSelect}
      />
    );

    expect(screen.queryByText('Select Exercise Type')).not.toBeInTheDocument();
  });

  it('renders modal when open', () => {
    mockedApi.get.mockResolvedValueOnce({ data: exerciseTypes });

    renderWithQueryClient(
      <ExerciseTypeModal
        isOpen={true}
        onClose={mockOnClose}
        onSelect={mockOnSelect}
      />
    );

    expect(screen.getByText('Select Exercise Type')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /close modal/i })).toBeInTheDocument();
  });

  it('fetches and displays exercise types', async () => {
    mockedApi.get.mockResolvedValueOnce({ data: exerciseTypes });

    renderWithQueryClient(
      <ExerciseTypeModal
        isOpen={true}
        onClose={mockOnClose}
        onSelect={mockOnSelect}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Bench Press')).toBeInTheDocument();
      expect(screen.getByText('Chest exercise')).toBeInTheDocument();
      expect(screen.getByText('Squat')).toBeInTheDocument();
      expect(screen.getByText('Leg exercise')).toBeInTheDocument();
      expect(screen.getByText('Deadlift')).toBeInTheDocument();
      expect(screen.getByText('Full body exercise')).toBeInTheDocument();
    });

    expect(mockedApi.get).toHaveBeenCalledWith('/exercise-types/?order_by=usage');
  });

  it('shows loading state while fetching', () => {
    mockedApi.get.mockReturnValue(new Promise(() => {})); // Never resolves

    renderWithQueryClient(
      <ExerciseTypeModal
        isOpen={true}
        onClose={mockOnClose}
        onSelect={mockOnSelect}
      />
    );

    // Should show skeleton loading cards
    expect(screen.getByText('Select Exercise Type')).toBeInTheDocument();
    // Check for skeleton elements (animated pulse divs)
    const skeletonElements = screen.getAllByRole('generic');
    const animatedElements = skeletonElements.filter(el => 
      el.className.includes('animate-pulse')
    );
    expect(animatedElements.length).toBeGreaterThan(0);
  });

  it('shows error state when fetch fails', async () => {
    mockedApi.get.mockRejectedValueOnce(new Error('Network error'));

    renderWithQueryClient(
      <ExerciseTypeModal
        isOpen={true}
        onClose={mockOnClose}
        onSelect={mockOnSelect}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Failed to load exercise types')).toBeInTheDocument();
      expect(screen.getByText('Please try again later')).toBeInTheDocument();
    });
  });

  it('shows empty state when no exercise types available', async () => {
    mockedApi.get.mockResolvedValueOnce({ data: [] });

    renderWithQueryClient(
      <ExerciseTypeModal
        isOpen={true}
        onClose={mockOnClose}
        onSelect={mockOnSelect}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('No exercise types available')).toBeInTheDocument();
      expect(screen.getByText('Contact support if this persists')).toBeInTheDocument();
    });
  });

  it('calls onSelect when exercise type is clicked', async () => {
    const user = userEvent.setup();
    mockedApi.get.mockResolvedValueOnce({ data: exerciseTypes });

    renderWithQueryClient(
      <ExerciseTypeModal
        isOpen={true}
        onClose={mockOnClose}
        onSelect={mockOnSelect}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Bench Press')).toBeInTheDocument();
    });

    const benchPressCard = screen.getByText('Bench Press').closest('div');
    await user.click(benchPressCard!);

    expect(mockOnSelect).toHaveBeenCalledWith(exerciseTypes[0]);
  });

  it('calls onClose when close button is clicked', async () => {
    const user = userEvent.setup();
    mockedApi.get.mockResolvedValueOnce({ data: exerciseTypes });

    renderWithQueryClient(
      <ExerciseTypeModal
        isOpen={true}
        onClose={mockOnClose}
        onSelect={mockOnSelect}
      />
    );

    const closeButton = screen.getByRole('button', { name: /close modal/i });
    await user.click(closeButton);

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('calls onClose when backdrop is clicked', async () => {
    const user = userEvent.setup();
    mockedApi.get.mockResolvedValueOnce({ data: exerciseTypes });

    renderWithQueryClient(
      <ExerciseTypeModal
        isOpen={true}
        onClose={mockOnClose}
        onSelect={mockOnSelect}
      />
    );

    // Click the backdrop directly by finding the element with the backdrop classes
    const backdrop = document.querySelector('.fixed.inset-0.bg-black.bg-opacity-50');
    expect(backdrop).toBeTruthy();
    
    if (backdrop) {
      await user.click(backdrop as Element);
      expect(mockOnClose).toHaveBeenCalled();
    }
  });

  it('displays exercise type icons with correct styling', async () => {
    mockedApi.get.mockResolvedValueOnce({ data: exerciseTypes });

    renderWithQueryClient(
      <ExerciseTypeModal
        isOpen={true}
        onClose={mockOnClose}
        onSelect={mockOnSelect}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('B')).toBeInTheDocument(); // Bench Press
      expect(screen.getByText('S')).toBeInTheDocument(); // Squat
      expect(screen.getByText('D')).toBeInTheDocument(); // Deadlift
    });

    // Check that icons have green background (different from workout types)
    const benchIcon = screen.getByText('B').parentElement;
    expect(benchIcon).toHaveClass('bg-green-600');
  });

  describe('Search functionality', () => {
    it('filters exercise types based on search term', async () => {
      const user = userEvent.setup();
      mockedApi.get.mockResolvedValueOnce({ data: exerciseTypes });

      renderWithQueryClient(
        <ExerciseTypeModal
          isOpen={true}
          onClose={mockOnClose}
          onSelect={mockOnSelect}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Bench Press')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('Search exercise types...');
      await user.type(searchInput, 'bench');

      expect(screen.getByText('Bench Press')).toBeInTheDocument();
      expect(screen.queryByText('Squat')).not.toBeInTheDocument();
      expect(screen.queryByText('Deadlift')).not.toBeInTheDocument();
    });

    it('filters exercise types based on description', async () => {
      const user = userEvent.setup();
      mockedApi.get.mockResolvedValueOnce({ data: exerciseTypes });

      renderWithQueryClient(
        <ExerciseTypeModal
          isOpen={true}
          onClose={mockOnClose}
          onSelect={mockOnSelect}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Bench Press')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('Search exercise types...');
      await user.type(searchInput, 'leg');

      expect(screen.getByText('Squat')).toBeInTheDocument();
      expect(screen.queryByText('Bench Press')).not.toBeInTheDocument();
      expect(screen.queryByText('Deadlift')).not.toBeInTheDocument();
    });

    it('shows no results state when search has no matches', async () => {
      const user = userEvent.setup();
      mockedApi.get.mockResolvedValueOnce({ data: exerciseTypes });

      renderWithQueryClient(
        <ExerciseTypeModal
          isOpen={true}
          onClose={mockOnClose}
          onSelect={mockOnSelect}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Bench Press')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('Search exercise types...');
      await user.type(searchInput, 'nonexistent');

      expect(screen.getByText('No results found')).toBeInTheDocument();
      expect(screen.getByText('Try a different search term or create a new exercise type')).toBeInTheDocument();
    });

    it('shows create button when search has no results', async () => {
      const user = userEvent.setup();
      mockedApi.get.mockResolvedValueOnce({ data: exerciseTypes });

      renderWithQueryClient(
        <ExerciseTypeModal
          isOpen={true}
          onClose={mockOnClose}
          onSelect={mockOnSelect}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Bench Press')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('Search exercise types...');
      await user.type(searchInput, 'Pull Up');

      const createButton = screen.getByTitle('Create "Pull Up"');
      expect(createButton).toBeInTheDocument();
    });

    it('shows clear button when search has text', async () => {
      const user = userEvent.setup();
      mockedApi.get.mockResolvedValueOnce({ data: exerciseTypes });

      renderWithQueryClient(
        <ExerciseTypeModal
          isOpen={true}
          onClose={mockOnClose}
          onSelect={mockOnSelect}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Bench Press')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('Search exercise types...');
      await user.type(searchInput, 'bench');

      const clearButton = screen.getByTitle('Clear search');
      expect(clearButton).toBeInTheDocument();

      await user.click(clearButton);
      expect(searchInput).toHaveValue('');
    });

    it('selects first result when Enter is pressed', async () => {
      const user = userEvent.setup();
      mockedApi.get.mockResolvedValueOnce({ data: exerciseTypes });

      renderWithQueryClient(
        <ExerciseTypeModal
          isOpen={true}
          onClose={mockOnClose}
          onSelect={mockOnSelect}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Bench Press')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('Search exercise types...');
      await user.type(searchInput, 'bench');
      await user.keyboard('{Enter}');

      expect(mockOnSelect).toHaveBeenCalledWith(exerciseTypes[0]);
    });

    it('clears search when Escape is pressed', async () => {
      const user = userEvent.setup();
      mockedApi.get.mockResolvedValueOnce({ data: exerciseTypes });

      renderWithQueryClient(
        <ExerciseTypeModal
          isOpen={true}
          onClose={mockOnClose}
          onSelect={mockOnSelect}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Bench Press')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('Search exercise types...');
      await user.type(searchInput, 'bench');
      await user.keyboard('{Escape}');

      expect(searchInput).toHaveValue('');
    });
  });

  describe('Create functionality', () => {
    it('creates new exercise type when create button is clicked', async () => {
      const user = userEvent.setup();
      const newExerciseType = { id: 4, name: 'Pull Up', description: 'Custom exercise', default_intensity_unit: 1, times_used: 0, created_at: '2024-01-01', updated_at: '2024-01-01' };
      
      mockedApi.get.mockResolvedValueOnce({ data: exerciseTypes });
      mockedApi.post.mockResolvedValueOnce({ data: newExerciseType });

      renderWithQueryClient(
        <ExerciseTypeModal
          isOpen={true}
          onClose={mockOnClose}
          onSelect={mockOnSelect}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Bench Press')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('Search exercise types...');
      await user.type(searchInput, 'Pull Up');

      const createButton = screen.getByTitle('Create "Pull Up"');
      await user.click(createButton);

      expect(mockedApi.post).toHaveBeenCalledWith('/exercise-types/', {
        name: 'Pull Up',
        description: 'Custom exercise',
        default_intensity_unit: 1,
      });

      await waitFor(() => {
        expect(mockOnSelect).toHaveBeenCalledWith(newExerciseType);
      });
    });

    it('shows loading state while creating exercise type', async () => {
      const user = userEvent.setup();
      mockedApi.get.mockResolvedValueOnce({ data: exerciseTypes });
      mockedApi.post.mockReturnValue(new Promise(() => {})); // Never resolves

      renderWithQueryClient(
        <ExerciseTypeModal
          isOpen={true}
          onClose={mockOnClose}
          onSelect={mockOnSelect}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Bench Press')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('Search exercise types...');
      await user.type(searchInput, 'Pull Up');

      const createButton = screen.getByTitle('Create "Pull Up"');
      await user.click(createButton);

      // Should show loading spinner
      expect(screen.getByRole('button', { name: /create/i })).toBeDisabled();
      expect(searchInput).toBeDisabled();
    });

    it('shows error message when create fails', async () => {
      const user = userEvent.setup();
      mockedApi.get.mockResolvedValueOnce({ data: exerciseTypes });
      mockedApi.post.mockRejectedValueOnce(new Error('Create failed'));

      renderWithQueryClient(
        <ExerciseTypeModal
          isOpen={true}
          onClose={mockOnClose}
          onSelect={mockOnSelect}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Bench Press')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('Search exercise types...');
      await user.type(searchInput, 'Pull Up');

      const createButton = screen.getByTitle('Create "Pull Up"');
      await user.click(createButton);

      await waitFor(() => {
        expect(screen.getByText('Failed to create exercise type. Please try again.')).toBeInTheDocument();
      });
    });

    it('does not show create button when search is empty', async () => {
      mockedApi.get.mockResolvedValueOnce({ data: exerciseTypes });

      renderWithQueryClient(
        <ExerciseTypeModal
          isOpen={true}
          onClose={mockOnClose}
          onSelect={mockOnSelect}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Bench Press')).toBeInTheDocument();
      });

      expect(screen.queryByTitle(/create/i)).not.toBeInTheDocument();
    });

    it('does not show create button when search has results', async () => {
      const user = userEvent.setup();
      mockedApi.get.mockResolvedValueOnce({ data: exerciseTypes });

      renderWithQueryClient(
        <ExerciseTypeModal
          isOpen={true}
          onClose={mockOnClose}
          onSelect={mockOnSelect}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Bench Press')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('Search exercise types...');
      await user.type(searchInput, 'bench');

      expect(screen.queryByTitle(/create/i)).not.toBeInTheDocument();
    });
  });

  describe('Usage tracking functionality', () => {
    it('displays usage counts for exercise types', async () => {
      mockedApi.get.mockResolvedValueOnce({ data: exerciseTypes });

      renderWithQueryClient(
        <ExerciseTypeModal
          isOpen={true}
          onClose={mockOnClose}
          onSelect={mockOnSelect}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('5 times')).toBeInTheDocument(); // Bench Press
        expect(screen.getByText('3 times')).toBeInTheDocument(); // Squat
        expect(screen.getByText('2 times')).toBeInTheDocument(); // Deadlift
      });
    });

    it('does not display usage count for exercise types with 0 uses', async () => {
      const exerciseTypesWithZero = [
        { id: 1, name: 'New Exercise', description: 'Never used', default_intensity_unit: 1, times_used: 0, created_at: '2024-01-01', updated_at: '2024-01-01' },
        { id: 2, name: 'Used Exercise', description: 'Used once', default_intensity_unit: 1, times_used: 1, created_at: '2024-01-01', updated_at: '2024-01-01' },
      ];
      
      mockedApi.get.mockResolvedValueOnce({ data: exerciseTypesWithZero });

      renderWithQueryClient(
        <ExerciseTypeModal
          isOpen={true}
          onClose={mockOnClose}
          onSelect={mockOnSelect}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('New Exercise')).toBeInTheDocument();
        expect(screen.getByText('1 time')).toBeInTheDocument(); // Used Exercise (singular)
      });

      // Should not show usage count for 0 times
      expect(screen.queryByText('0 times')).not.toBeInTheDocument();
    });

    it('displays correct singular/plural form for usage counts', async () => {
      const exerciseTypesVariedUsage = [
        { id: 1, name: 'Once Used', description: 'Used once', default_intensity_unit: 1, times_used: 1, created_at: '2024-01-01', updated_at: '2024-01-01' },
        { id: 2, name: 'Multi Used', description: 'Used multiple times', default_intensity_unit: 1, times_used: 5, created_at: '2024-01-01', updated_at: '2024-01-01' },
      ];
      
      mockedApi.get.mockResolvedValueOnce({ data: exerciseTypesVariedUsage });

      renderWithQueryClient(
        <ExerciseTypeModal
          isOpen={true}
          onClose={mockOnClose}
          onSelect={mockOnSelect}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('1 time')).toBeInTheDocument(); // Singular
        expect(screen.getByText('5 times')).toBeInTheDocument(); // Plural
      });
    });

    it('exercise types are ordered by usage (most used first)', async () => {
      // Exercise types already sorted by backend (API returns sorted data)
      const sortedExerciseTypes = [
        { id: 1, name: 'High Usage', description: 'Used most', default_intensity_unit: 1, times_used: 10, created_at: '2024-01-01', updated_at: '2024-01-01' },
        { id: 2, name: 'Medium Usage', description: 'Used middle', default_intensity_unit: 1, times_used: 5, created_at: '2024-01-01', updated_at: '2024-01-01' },
        { id: 3, name: 'Low Usage', description: 'Used least', default_intensity_unit: 1, times_used: 1, created_at: '2024-01-01', updated_at: '2024-01-01' },
      ];

      mockedApi.get.mockResolvedValueOnce({ data: sortedExerciseTypes });

      renderWithQueryClient(
        <ExerciseTypeModal
          isOpen={true}
          onClose={mockOnClose}
          onSelect={mockOnSelect}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('High Usage')).toBeInTheDocument();
      });

      // Verify that all exercise types are rendered in the correct order
      const exerciseHeaders = screen.getAllByRole('heading', { level: 4 });
      
      // Should be ordered by usage DESC: High Usage (10), Medium Usage (5), Low Usage (1)
      expect(exerciseHeaders).toHaveLength(3);
      expect(exerciseHeaders[0]).toHaveTextContent('High Usage');
      expect(exerciseHeaders[1]).toHaveTextContent('Medium Usage');
      expect(exerciseHeaders[2]).toHaveTextContent('Low Usage');
    });
  });
});