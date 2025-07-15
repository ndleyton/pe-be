import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getMyWorkouts, type Workout } from '@/features/workouts';
import api from '@/shared/api/client';

vi.mock('@/shared/api/client');

const mockApi = vi.mocked(api);

describe('workouts API - pagination', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getMyWorkouts', () => {
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
        name: 'Evening Workout',
        notes: null,
        start_time: '2024-01-01T18:00:00Z',
        end_time: '2024-01-01T19:30:00Z',
        created_at: '2024-01-01T18:00:00Z',
        updated_at: '2024-01-01T19:30:00Z',
      },
    ];

    it('should call API with default pagination parameters', async () => {
      mockApi.get.mockResolvedValue({ data: mockWorkouts });

      const result = await getMyWorkouts();

      expect(mockApi.get).toHaveBeenCalledWith('/workouts/mine?offset=0&limit=100');
      expect(result).toEqual(mockWorkouts);
    });

    it('should call API with custom pagination parameters', async () => {
      mockApi.get.mockResolvedValue({ data: mockWorkouts });

      await getMyWorkouts(20, 50);

      expect(mockApi.get).toHaveBeenCalledWith('/workouts/mine?offset=20&limit=50');
    });

    it('should handle offset 0 and limit 100', async () => {
      mockApi.get.mockResolvedValue({ data: mockWorkouts });

      await getMyWorkouts(0, 100);

      expect(mockApi.get).toHaveBeenCalledWith('/workouts/mine?offset=0&limit=100');
    });

    it('should handle large offset values', async () => {
      mockApi.get.mockResolvedValue({ data: [] });

      await getMyWorkouts(1000, 100);

      expect(mockApi.get).toHaveBeenCalledWith('/workouts/mine?offset=1000&limit=100');
    });

    it('should handle small limit values', async () => {
      mockApi.get.mockResolvedValue({ data: mockWorkouts.slice(0, 1) });

      await getMyWorkouts(0, 1);

      expect(mockApi.get).toHaveBeenCalledWith('/workouts/mine?offset=0&limit=1');
    });

    it('should handle API errors', async () => {
      const apiError = new Error('API Error');
      mockApi.get.mockRejectedValue(apiError);

      await expect(getMyWorkouts()).rejects.toThrow('API Error');
    });

    it('should handle 401 unauthorized errors', async () => {
      const unauthorizedError = {
        response: { status: 401 },
        message: 'Unauthorized',
      };
      mockApi.get.mockRejectedValue(unauthorizedError);

      await expect(getMyWorkouts()).rejects.toEqual(unauthorizedError);
    });

    it('should handle empty response', async () => {
      mockApi.get.mockResolvedValue({ data: [] });

      const result = await getMyWorkouts(100, 100);

      expect(result).toEqual([]);
      expect(mockApi.get).toHaveBeenCalledWith('/workouts/mine?offset=100&limit=100');
    });

    it('should handle response with exactly limit items', async () => {
      const fullPageData: Workout[] = Array.from({ length: 100 }, (_, i) => ({
        id: i + 1,
        name: `Workout ${i + 1}`,
        notes: `Notes ${i + 1}`,
        start_time: `2024-01-0${(i % 9) + 1}T08:00:00Z`,
        end_time: `2024-01-0${(i % 9) + 1}T09:00:00Z`,
        created_at: `2024-01-0${(i % 9) + 1}T08:00:00Z`,
        updated_at: `2024-01-0${(i % 9) + 1}T09:00:00Z`,
      }));

      mockApi.get.mockResolvedValue({ data: fullPageData });

      const result = await getMyWorkouts(0, 100);

      expect(result).toHaveLength(100);
      expect(mockApi.get).toHaveBeenCalledWith('/workouts/mine?offset=0&limit=100');
    });

    it('should handle response with less than limit items', async () => {
      const partialPageData = mockWorkouts.slice(0, 1);
      mockApi.get.mockResolvedValue({ data: partialPageData });

      const result = await getMyWorkouts(50, 100);

      expect(result).toHaveLength(1);
      expect(mockApi.get).toHaveBeenCalledWith('/workouts/mine?offset=50&limit=100');
    });

    it('should handle workouts with null values', async () => {
      const workoutsWithNulls: Workout[] = [
        {
          id: 1,
          name: null,
          notes: null,
          start_time: '2024-01-01T08:00:00Z',
          end_time: null, // Ongoing workout
          created_at: '2024-01-01T08:00:00Z',
          updated_at: '2024-01-01T08:00:00Z',
        },
      ];

      mockApi.get.mockResolvedValue({ data: workoutsWithNulls });

      const result = await getMyWorkouts();

      expect(result).toEqual(workoutsWithNulls);
      expect(result[0].name).toBeNull();
      expect(result[0].notes).toBeNull();
      expect(result[0].end_time).toBeNull();
    });

    it('should handle string IDs', async () => {
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

      mockApi.get.mockResolvedValue({ data: workoutsWithStringIds });

      const result = await getMyWorkouts();

      expect(result).toEqual(workoutsWithStringIds);
      expect(typeof result[0].id).toBe('string');
    });
  });
});