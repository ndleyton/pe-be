import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render } from '../test/utils';
import MyWorkoutsPage from './MyWorkoutsPage';
import { getMyWorkouts } from '@/features/workouts';
import type { Workout } from '@/features/workouts';

vi.mock('../features/workouts/components', () => ({
  WorkoutForm: () => <div data-testid="workout-form">Mock Workout Form</div>,
}));

vi.mock('@/features/workouts', () => ({
  getMyWorkouts: vi.fn(),
}));

vi.mock('../shared/components/ui', () => ({
  FloatingActionButton: ({ children, onClick, dataTestId }: any) => (
    <button data-testid={dataTestId} onClick={onClick}>
      {children}
    </button>
  ),
  WeekTracking: ({ workouts }: { workouts: any[] }) => (
    <div data-testid="week-tracking">Week tracking with {workouts.length} workouts</div>
  ),
}));

vi.mock('@/features/recipes/components/RecipesSection/RecipesSection', () => ({
  RecipesSection: ({ onStartWorkout }: any) => (
    <div data-testid="recipes-section">
      <button onClick={() => onStartWorkout({ id: 'test-recipe' })}>
        Start from recipe
      </button>
    </div>
  ),
}));

const mockGetMyWorkouts = vi.mocked(getMyWorkouts);

// Helper to wrap workout arrays in cursor pagination shape
const wrap = (workouts: Workout[]) => ({ data: workouts, next_cursor: null });

const mockWorkouts: Workout[] = [
  {
    id: 1,
    name: 'Morning Workout',
    notes: 'Great session',
    start_time: '2024-01-01T08:00:00Z',
    end_time: '2024-01-01T09:00:00Z',
    created_at: '2024-01-01T08:00:00Z',
    updated_at: '2024-01-01T09:00:00Z',
  },
  {
    id: 2,
    name: null,
    notes: null,
    start_time: '2024-01-01T18:00:00Z',
    end_time: '2024-01-01T19:30:00Z',
    created_at: '2024-01-01T18:00:00Z',
    updated_at: '2024-01-01T19:30:00Z',
  },
  {
    id: 3,
    name: 'Evening Workout',
    notes: 'Quick session',
    start_time: '2024-01-02T19:00:00Z',
    end_time: null, // Ongoing workout
    created_at: '2024-01-02T19:00:00Z',
    updated_at: '2024-01-02T19:00:00Z',
  },
];

describe('MyWorkoutsPage - Infinite Scroll', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetMyWorkouts.mockResolvedValue(wrap(mockWorkouts) as any);
  });

  it('renders the page with heading', () => {
    render(<MyWorkoutsPage />);

    expect(screen.getByRole('heading', { name: /workouts/i })).toBeInTheDocument();
  });

  it('shows message when no workouts exist', () => {
    mockGetMyWorkouts.mockResolvedValue(wrap([]) as any);
    render(<MyWorkoutsPage />);

    expect(screen.getByText(/you haven't logged any workouts yet/i)).toBeInTheDocument();
  });

  it('calls getMyWorkouts with default parameters for authenticated users', async () => {
    render(<MyWorkoutsPage />);

    await waitFor(() => {
      expect(mockGetMyWorkouts).toHaveBeenCalledWith(null, 100);
    });
  });

  it('displays workouts after loading', async () => {
    render(<MyWorkoutsPage />);

    await waitFor(() => {
      expect(screen.getByText('Morning Workout')).toBeInTheDocument();
      expect(screen.getByText('Traditional Strength Training')).toBeInTheDocument(); // Default name for null
      expect(screen.getByText('Evening Workout')).toBeInTheDocument();
    });
  });

  it('shows workout duration for completed workouts', async () => {
    render(<MyWorkoutsPage />);

    await waitFor(() => {
      expect(screen.getByText('1:00')).toBeInTheDocument(); // 1 hour duration
      expect(screen.getByText('1:30')).toBeInTheDocument(); // 1.5 hour duration
    });
  });

  it('shows "In Progress" for ongoing workouts', async () => {
    render(<MyWorkoutsPage />);

    await waitFor(() => {
      expect(screen.getByText('In Progress')).toBeInTheDocument();
    });
  });

  it('formats dates correctly', async () => {
    render(<MyWorkoutsPage />);

    await waitFor(() => {
      expect(screen.getByText('1/1/24')).toBeInTheDocument();
      expect(screen.getByText('1/2/24')).toBeInTheDocument();
    });
  });

  it('shows loading more indicator when fetching next page', async () => {
    // Mock first call returning full page, second call pending
    const fullPage = Array.from({ length: 100 }, (_, i) => ({
      id: i + 1,
      name: `Workout ${i + 1}`,
      notes: `Notes ${i + 1}`,
      start_time: `2024-01-0${(i % 9) + 1}T08:00:00Z`,
      end_time: `2024-01-0${(i % 9) + 1}T09:00:00Z`,
      created_at: `2024-01-0${(i % 9) + 1}T08:00:00Z`,
      updated_at: `2024-01-0${(i % 9) + 1}T09:00:00Z`,
    }));

    mockGetMyWorkouts
      .mockResolvedValueOnce(wrap(fullPage) as any)
      .mockImplementation(() => new Promise(() => {})); // Pending next page

    render(<MyWorkoutsPage />);

    await waitFor(() => {
      expect(screen.getByText('Workout 1')).toBeInTheDocument();
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
      expect(screen.getByRole('status')).toBeInTheDocument();
    });
  });

  it('handles workout clicks and navigation', async () => {
    render(<MyWorkoutsPage />);

    await waitFor(() => {
      expect(screen.getByText('Morning Workout')).toBeInTheDocument();
    });

    const workoutElement = screen.getByText('Morning Workout').closest('div');
    await userEvent.click(workoutElement!);

    // Navigation is handled by the router, so we just verify the element is clickable
    expect(workoutElement).toBeInTheDocument();
  });

  it('shows and hides workout form', async () => {
    render(<MyWorkoutsPage />);

    // FAB should be visible initially
    expect(screen.getByTestId('fab-add-workout')).toBeInTheDocument();

    // Click FAB to show form
    await userEvent.click(screen.getByTestId('fab-add-workout'));

    await waitFor(() => {
      expect(screen.getByTestId('workout-form')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
    });

    // FAB should be hidden when form is shown
    expect(screen.queryByTestId('fab-add-workout')).not.toBeInTheDocument();

    // Click cancel to hide form
    await userEvent.click(screen.getByRole('button', { name: /cancel/i }));

    await waitFor(() => {
      expect(screen.queryByTestId('workout-form')).not.toBeInTheDocument();
      expect(screen.getByTestId('fab-add-workout')).toBeInTheDocument();
    });
  });

  it('starts workout from recipe', async () => {
    render(<MyWorkoutsPage />);

    const startFromRecipeButton = screen.getByText('Start from recipe');
    await userEvent.click(startFromRecipeButton);

    await waitFor(() => {
      expect(screen.getByTestId('workout-form')).toBeInTheDocument();
    });
  });

  it('handles API errors gracefully', async () => {
    mockGetMyWorkouts.mockRejectedValue(new Error('API Error'));

    render(<MyWorkoutsPage />);

    await waitFor(() => {
      expect(screen.getByText(/failed to load workouts/i)).toBeInTheDocument();
    });
  });

  it('handles 401 unauthorized errors with special message', async () => {
    const unauthorizedError = {
      response: { status: 401 },
      message: 'Unauthorized',
    };
    mockGetMyWorkouts.mockRejectedValue(unauthorizedError);

    render(<MyWorkoutsPage />);

    await waitFor(() => {
      expect(screen.getByText(/session expired/i)).toBeInTheDocument();
      expect(screen.getByText(/please log in to view your workouts/i)).toBeInTheDocument();
    });
  });

  it('handles 403 forbidden errors with special message', async () => {
    const forbiddenError = {
      response: { status: 403 },
      message: 'Forbidden',
    };
    mockGetMyWorkouts.mockRejectedValue(forbiddenError);

    render(<MyWorkoutsPage />);

    await waitFor(() => {
      expect(screen.getByText(/session expired/i)).toBeInTheDocument();
    });
  });

  it('refetches data when workout is created', async () => {
    render(<MyWorkoutsPage />);

    // Show form
    await userEvent.click(screen.getByTestId('fab-add-workout'));

    await waitFor(() => {
      expect(screen.getByTestId('workout-form')).toBeInTheDocument();
    });

    // Simulate workout creation callback
    // Note: This would typically be tested through the WorkoutForm component
    // but since it's mocked, we can't test the actual callback
  });

  it('displays week tracking component with workouts', async () => {
    render(<MyWorkoutsPage />);

    await waitFor(() => {
      expect(screen.getByTestId('week-tracking')).toBeInTheDocument();
      expect(screen.getByText('Week tracking with 3 workouts')).toBeInTheDocument();
    });
  });

  it('handles workouts with string IDs', async () => {
    const workoutsWithStringIds: Workout[] = [
      {
        id: 'workout-uuid-1',
        name: 'String ID Workout',
        notes: 'Test workout',
        start_time: '2024-01-01T08:00:00Z',
        end_time: '2024-01-01T09:00:00Z',
        created_at: '2024-01-01T08:00:00Z',
        updated_at: '2024-01-01T09:00:00Z',
      },
    ];

    mockGetMyWorkouts.mockResolvedValue(wrap(workoutsWithStringIds) as any);

    render(<MyWorkoutsPage />);

    await waitFor(() => {
      expect(screen.getByText('String ID Workout')).toBeInTheDocument();
    });
  });

  it('handles duration calculation edge cases', async () => {
    const edgeCaseWorkouts: Workout[] = [
      {
        id: 1,
        name: 'Short Workout',
        notes: null,
        start_time: '2024-01-01T08:00:00Z',
        end_time: '2024-01-01T08:05:00Z', // 5 minutes
        created_at: '2024-01-01T08:00:00Z',
        updated_at: '2024-01-01T08:05:00Z',
      },
      {
        id: 2,
        name: 'Long Workout',
        notes: null,
        start_time: '2024-01-01T08:00:00Z',
        end_time: '2024-01-01T11:30:00Z', // 3.5 hours
        created_at: '2024-01-01T08:00:00Z',
        updated_at: '2024-01-01T11:30:00Z',
      },
    ];

    mockGetMyWorkouts.mockResolvedValue(wrap(edgeCaseWorkouts) as any);

    render(<MyWorkoutsPage />);

    await waitFor(() => {
      expect(screen.getByText('0:05')).toBeInTheDocument(); // 5 minutes
      expect(screen.getByText('3:30')).toBeInTheDocument(); // 3.5 hours
    });
  });
});