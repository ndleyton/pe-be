import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import axios from 'axios';
import { render } from '../test/utils';
import MyWorkoutsPage from './MyWorkoutsPage';

vi.mock('axios');
const mockedAxios = vi.mocked(axios, true);

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
    mockedAxios.get.mockImplementation(() => new Promise(() => {})); // Never resolves
    
    render(<MyWorkoutsPage />);

    expect(screen.getByText(/loading workouts/i)).toBeInTheDocument();
  });

  it('renders page title and workout form', async () => {
    mockedAxios.get.mockResolvedValueOnce({ data: [] });

    render(<MyWorkoutsPage />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /my workouts/i })).toBeInTheDocument();
      expect(screen.getByTestId('workout-form')).toBeInTheDocument();
    });
  });

  it('shows message when no workouts exist', async () => {
    mockedAxios.get.mockResolvedValueOnce({ data: [] });

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

    mockedAxios.get.mockResolvedValueOnce({ data: mockWorkouts });

    render(<MyWorkoutsPage />);

    await waitFor(() => {
      // First workout
      expect(screen.getByText('Morning Workout')).toBeInTheDocument();
      expect(screen.getByText('Notes: Great session')).toBeInTheDocument();
      expect(screen.getByText(/started: 1\/1\/2024/i)).toBeInTheDocument();
      expect(screen.getByText(/ended: 1\/1\/2024/i)).toBeInTheDocument();

      // Second workout (with nulls)
      expect(screen.getByText('Unnamed Workout')).toBeInTheDocument();
      expect(screen.getByText('Notes: N/A')).toBeInTheDocument();
      expect(screen.getByText(/started: 1\/2\/2024/i)).toBeInTheDocument();
      expect(screen.queryByText(/ended: 1\/2\/2024/i)).not.toBeInTheDocument();
    });
  });

  it('makes API call with correct parameters', async () => {
    mockedAxios.get.mockResolvedValueOnce({ data: [] });

    render(<MyWorkoutsPage />);

    await waitFor(() => {
      expect(mockedAxios.get).toHaveBeenCalledWith(
        'http://localhost:8000/api/workouts/mine',
        { withCredentials: true }
      );
    });
  });
});