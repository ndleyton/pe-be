import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { GuestDataProvider, useGuestData } from './GuestDataContext';
import { AuthProvider } from './AuthContext';
import api from '../api/client';

// Mock API client
vi.mock('../api/client', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

const mockApi = vi.mocked(api);

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Test component that uses the context
const TestComponent = () => {
  const { data, actions, isAuthenticated } = useGuestData();
  
  return (
    <div>
      <div data-testid="workout-count">{data.workouts.length}</div>
      <div data-testid="is-authenticated">{isAuthenticated().toString()}</div>
      <button 
        data-testid="add-workout" 
        onClick={() => {
          const workoutType = data.workoutTypes[0];
          actions.addWorkout({
            name: 'Test Workout',
            notes: 'Test notes',
            start_time: new Date().toISOString(),
            end_time: null,
            workout_type_id: workoutType.id,
            workout_type: workoutType,
          });
        }}
      >
        Add Workout
      </button>
      <button 
        data-testid="clear-data" 
        onClick={() => actions.clear()}
      >
        Clear Data
      </button>
    </div>
  );
};

describe('GuestDataContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.getItem.mockReturnValue(null);
    // Mock API to return no user by default (cast to any for proper typing)
    (mockApi.get as any).mockRejectedValue(new Error('Unauthorized'));
  });

  it('provides initial data with default exercise and workout types', () => {
    render(
      <AuthProvider>
        <GuestDataProvider>
          <TestComponent />
        </GuestDataProvider>
      </AuthProvider>
    );

    expect(screen.getByTestId('workout-count')).toHaveTextContent('0');
    expect(screen.getByTestId('is-authenticated')).toHaveTextContent('false');
  });

  it('adds a workout and persists to localStorage', () => {
    render(
      <AuthProvider>
        <GuestDataProvider>
          <TestComponent />
        </GuestDataProvider>
      </AuthProvider>
    );

    act(() => {
      screen.getByTestId('add-workout').click();
    });

    expect(screen.getByTestId('workout-count')).toHaveTextContent('1');
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'pe-guest-data',
      expect.stringContaining('Test Workout')
    );
  });

  it('loads data from localStorage on initialization', () => {
    const mockData = {
      workouts: [
        {
          id: 'test-id',
          name: 'Saved Workout',
          notes: null,
          start_time: '2023-01-01T00:00:00.000Z',
          end_time: null,
          workout_type_id: 'wt-1',
          workout_type: { id: 'wt-1', name: 'Test Type', description: 'Test' },
          exercises: [],
          created_at: '2023-01-01T00:00:00.000Z',
          updated_at: '2023-01-01T00:00:00.000Z',
        }
      ],
      exerciseTypes: [],
      workoutTypes: [
        { id: 'wt-1', name: 'Test Type', description: 'Test' }
      ],
    };

    localStorageMock.getItem.mockReturnValue(JSON.stringify(mockData));

    render(
      <AuthProvider>
        <GuestDataProvider>
          <TestComponent />
        </GuestDataProvider>
      </AuthProvider>
    );

    expect(screen.getByTestId('workout-count')).toHaveTextContent('1');
  });

  it('clears data and removes from localStorage', () => {
    render(
      <AuthProvider>
        <GuestDataProvider>
          <TestComponent />
        </GuestDataProvider>
      </AuthProvider>
    );

    // Add a workout first
    act(() => {
      screen.getByTestId('add-workout').click();
    });

    expect(screen.getByTestId('workout-count')).toHaveTextContent('1');

    // Clear data
    act(() => {
      screen.getByTestId('clear-data').click();
    });

    expect(screen.getByTestId('workout-count')).toHaveTextContent('0');
    expect(localStorageMock.removeItem).toHaveBeenCalledWith('pe-guest-data');
  });

  it('returns true for isAuthenticated when user is logged in', async () => {
    // Mock API to return a user
    (mockApi.get as any).mockResolvedValue({
      data: { id: 1, email: 'test@example.com', name: 'Test User' }
    });

    render(
      <AuthProvider>
        <GuestDataProvider>
          <TestComponent />
        </GuestDataProvider>
      </AuthProvider>
    );

    // Wait for the API call to complete
    await screen.findByTestId('is-authenticated');
    expect(screen.getByTestId('is-authenticated')).toHaveTextContent('true');
  });

  it('handles corrupted localStorage data gracefully', () => {
    localStorageMock.getItem.mockReturnValue('invalid-json');

    // Should not throw and should use default data
    render(
      <AuthProvider>
        <GuestDataProvider>
          <TestComponent />
        </GuestDataProvider>
      </AuthProvider>
    );

    expect(screen.getByTestId('workout-count')).toHaveTextContent('0');
  });
});