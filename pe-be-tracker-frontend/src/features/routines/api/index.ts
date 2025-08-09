import { api } from '@/shared/api';
import { Routine } from '@/features/routines/types';

export const getRoutines = async (
  orderBy: 'name' | 'createdAt' = 'createdAt',
  cursor: number = 0,
  limit: number = 100
): Promise<Routine[]> => {
  const response = await api.get('/routines/', {
    params: {
      order_by: orderBy,
      offset: cursor,
      limit: limit,
    },
  });
  return response.data;
};

export const getRoutine = async (id: number): Promise<Routine> => {
  const response = await api.get(`/routines/${id}`);
  return response.data;
};
