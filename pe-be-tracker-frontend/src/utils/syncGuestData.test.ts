import { describe, it, expect, vi, beforeEach } from 'vitest';
import { syncGuestDataToServer } from './syncGuestData';
import type { GuestData } from '../contexts/GuestDataContext';

// Mock the API client
vi.mock('../api/client', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

// Mock the date utility
vi.mock('./date', () => ({
  toUTCISOString: vi.fn((date) => date),
}));

import api from '../api/client';

describe('syncGuestDataToServer', () => {
  const mockClearGuestData = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns success when no guest data to sync', async () => {
    const emptyGuestData: GuestData = {
      workouts: [],
      exerciseTypes: [],
      workoutTypes: [],
    };

    const result = await syncGuestDataToServer(emptyGuestData, mockClearGuestData);

    expect(result).toEqual({
      success: true,
      syncedWorkouts: 0,
      syncedExercises: 0,
      syncedSets: 0,
    });
    expect(mockClearGuestData).not.toHaveBeenCalled();
  });

  it('syncs workout data successfully', async () => {
    const mockGuestData: GuestData = {
      workouts: [
        {
          id: 'guest-workout-1',
          name: 'Test Workout',
          notes: 'Test notes',
          start_time: '2023-01-01T10:00:00Z',
          end_time: '2023-01-01T11:00:00Z',
          workout_type_id: 'guest-wt-1',
          workout_type: {
            id: 'guest-wt-1',
            name: 'Strength Training',
            description: 'Traditional strength training',
          },
          exercises: [
            {
              id: 'guest-exercise-1',
              timestamp: '2023-01-01T10:30:00Z',
              notes: 'Exercise notes',
              exercise_type_id: 'guest-et-1',
              workout_id: 'guest-workout-1',
              created_at: '2023-01-01T10:00:00Z',
              updated_at: '2023-01-01T10:00:00Z',
              exercise_type: {
                id: 'guest-et-1',
                name: 'Push-ups',
                description: 'Upper body exercise',
                default_intensity_unit: 1,
                times_used: 1,
              },
              exercise_sets: [
                {
                  id: 'guest-set-1',
                  reps: 10,
                  intensity: null,
                  intensity_unit_id: 1,
                  exercise_id: 'guest-exercise-1',
                  rest_time_seconds: 60,
                  done: true,
                  created_at: '2023-01-01T10:30:00Z',
                  updated_at: '2023-01-01T10:30:00Z',
                },
              ],
            },
          ],
          created_at: '2023-01-01T10:00:00Z',
          updated_at: '2023-01-01T10:00:00Z',
        },
      ],
      exerciseTypes: [],
      workoutTypes: [],
    };

    // Mock API responses
    (api.get as any)
      .mockResolvedValueOnce({ data: [] }) // exercise types
      .mockResolvedValueOnce({ data: [] }); // workout types

    (api.post as any)
      .mockResolvedValueOnce({ data: { id: 1, name: 'Push-ups' } }) // create exercise type
      .mockResolvedValueOnce({ data: { id: 1, name: 'Strength Training' } }) // create workout type
      .mockResolvedValueOnce({ data: { id: 1, name: 'Test Workout' } }) // create workout
      .mockResolvedValueOnce({ data: { id: 1, exercise_type_id: 1 } }) // create exercise
      .mockResolvedValueOnce({ data: { id: 1, exercise_id: 1 } }); // create exercise set

    const result = await syncGuestDataToServer(mockGuestData, mockClearGuestData);

    expect(result).toEqual({
      success: true,
      syncedWorkouts: 1,
      syncedExercises: 1,
      syncedSets: 1,
    });

    expect(mockClearGuestData).toHaveBeenCalled();

    // Verify API calls
    expect(api.post).toHaveBeenCalledWith('/exercise-types/', {
      name: 'Push-ups',
      description: 'Upper body exercise',
      default_intensity_unit: 1,
    });

    expect(api.post).toHaveBeenCalledWith('/workout-types/', {
      name: 'Strength Training',
      description: 'Traditional strength training',
    });

    expect(api.post).toHaveBeenCalledWith('/workouts/', {
      name: 'Test Workout',
      notes: 'Test notes',
      start_time: '2023-01-01T10:00:00Z',
      end_time: '2023-01-01T11:00:00Z',
      workout_type_id: 1,
    });
  });

  it('handles API errors gracefully', async () => {
    const mockGuestData: GuestData = {
      workouts: [
        {
          id: 'guest-workout-1',
          name: 'Test Workout',
          notes: null,
          start_time: '2023-01-01T10:00:00Z',
          end_time: null,
          workout_type_id: 'guest-wt-1',
          workout_type: {
            id: 'guest-wt-1',
            name: 'Strength Training',
            description: 'Traditional strength training',
          },
          exercises: [],
          created_at: '2023-01-01T10:00:00Z',
          updated_at: '2023-01-01T10:00:00Z',
        },
      ],
      exerciseTypes: [],
      workoutTypes: [],
    };

    // Mock API to throw an error
    (api.get as any).mockRejectedValue(new Error('Network error'));

    const result = await syncGuestDataToServer(mockGuestData, mockClearGuestData);

    expect(result).toEqual({
      success: false,
      error: 'Network error',
      syncedWorkouts: 0,
      syncedExercises: 0,
      syncedSets: 0,
    });

    expect(mockClearGuestData).not.toHaveBeenCalled();
  });

  it('finds existing exercise and workout types instead of creating duplicates', async () => {
    const mockGuestData: GuestData = {
      workouts: [
        {
          id: 'guest-workout-1',
          name: 'Test Workout',
          notes: null,
          start_time: '2023-01-01T10:00:00Z',
          end_time: null,
          workout_type_id: 'guest-wt-1',
          workout_type: {
            id: 'guest-wt-1',
            name: 'Strength Training',
            description: 'Traditional strength training',
          },
          exercises: [
            {
              id: 'guest-exercise-1',
              timestamp: '2023-01-01T10:30:00Z',
              notes: null,
              exercise_type_id: 'guest-et-1',
              workout_id: 'guest-workout-1',
              created_at: '2023-01-01T10:00:00Z',
              updated_at: '2023-01-01T10:00:00Z',
              exercise_type: {
                id: 'guest-et-1',
                name: 'push-ups', // lowercase to test case-insensitive matching
                description: 'Upper body exercise',
                default_intensity_unit: 1,
                times_used: 1,
              },
              exercise_sets: [],
            },
          ],
          created_at: '2023-01-01T10:00:00Z',
          updated_at: '2023-01-01T10:00:00Z',
        },
      ],
      exerciseTypes: [],
      workoutTypes: [],
    };

    // Mock API responses with existing types
    (api.get as any)
      .mockResolvedValueOnce({ 
        data: [{ id: 5, name: 'Push-ups', description: 'Existing push-ups' }] 
      }) // existing exercise types
      .mockResolvedValueOnce({ 
        data: [{ id: 3, name: 'Strength Training', description: 'Existing type' }] 
      }); // existing workout types

    (api.post as any)
      .mockResolvedValueOnce({ data: { id: 1, name: 'Test Workout' } }) // create workout
      .mockResolvedValueOnce({ data: { id: 1, exercise_type_id: 5 } }); // create exercise

    const result = await syncGuestDataToServer(mockGuestData, mockClearGuestData);

    expect(result.success).toBe(true);

    // Should not have called POST for exercise-types or workout-types since they already exist
    expect(api.post).toHaveBeenCalledWith('/workouts/', {
      name: 'Test Workout',
      notes: null,
      start_time: '2023-01-01T10:00:00Z',
      end_time: null,
      workout_type_id: 3, // Uses existing workout type ID
    });

    expect(api.post).toHaveBeenCalledWith('/exercises/', {
      exercise_type_id: 5, // Uses existing exercise type ID
      workout_id: 1,
      timestamp: '2023-01-01T10:30:00Z',
      notes: null,
    });
  });
});