import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import api from '../api/client';
import { render } from '../test/utils';
import MyWorkoutsPage from './MyWorkoutsPage';

vi.mock('../api/client');
const mockedApi = vi.mocked(api, true);

vi.mock('../components/WorkoutForm', () => ({
  default: ({ onWorkoutCreated }: { onWorkoutCreated: () => void }) => (
    <div data-testid="workout-form">
      <button onClick={onWorkoutCreated}>Mock Create Workout</button>
    </div>
  ),
}));

describe('MyWorkoutsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading state initially', () => {
    mockedApi.get.mockImplementation(() => new Promise(() => {})); // Never resolves
    
    render(<MyWorkoutsPage />);

    expect(screen.getByText(/loading workouts/i)).toBeInTheDocument();
  });

  it('renders page title and workout form', async () => {
    mockedApi.get.mockResolvedValueOnce({ data: [] });

    render(<MyWorkoutsPage />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /workouts/i })).toBeInTheDocument();
      expect(screen.getByTestId('workout-form')).toBeInTheDocument();
    });
  });

  it('shows message when no workouts exist', async () => {
    mockedApi.get.mockResolvedValueOnce({ data: [] });

    render(<MyWorkoutsPage />);

    await waitFor(() => {
      expect(screen.getByText(/you haven't logged any workouts yet/i)).toBeInTheDocument();
    });
  });

  it('displays list of workouts when data is available', async () => {
    const mockWorkouts = [
      {
        id: 1,
        name: 'Morning Workout',
        notes: 'Great session',
        start_time: '2024-01-01T10:00:00Z',
        end_time: '2024-01-01T11:00:00Z',
      },
      {
        id: 2,
        name: null,
        notes: null,
        start_time: '2024-01-02T14:00:00Z',
        end_time: null,
      },
    ];

    mockedApi.get.mockResolvedValueOnce({ data: mockWorkouts });

    render(<MyWorkoutsPage />);

    await waitFor(() => {
      // First workout
      expect(screen.getByText('Morning Workout')).toBeInTheDocument();
      expect(screen.getByText('1:00')).toBeInTheDocument(); // Duration
      expect(screen.getByText('1/1/24')).toBeInTheDocument(); // Date format

      // Second workout (with nulls)
      expect(screen.getByText('Traditional Strength Training')).toBeInTheDocument(); // Default name
      expect(screen.getByText('In Progress')).toBeInTheDocument(); // No end time
      expect(screen.getByText('1/2/24')).toBeInTheDocument(); // Date format
    });
  });

  it('makes API call with correct parameters', async () => {
    mockedApi.get.mockResolvedValueOnce({ data: [] });

    render(<MyWorkoutsPage />);

    await waitFor(() => {
      expect(mockedApi.get).toHaveBeenCalledWith('/workouts/mine');
    });
  });
});