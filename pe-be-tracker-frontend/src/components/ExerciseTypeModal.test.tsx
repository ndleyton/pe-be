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
  { id: 1, name: 'Bench Press', description: 'Chest exercise', default_intensity_unit: 1 },
  { id: 2, name: 'Squat', description: 'Leg exercise', default_intensity_unit: 1 },
  { id: 3, name: 'Deadlift', description: 'Full body exercise', default_intensity_unit: 1 },
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

    expect(mockedApi.get).toHaveBeenCalledWith('/exercise-types/');
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
});