import React from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import WorkoutForm from '../components/WorkoutForm';

type Workout = {
  id: number;
  name: string | null;
  notes: string | null;
  start_time: string;
  end_time: string | null;
}

const fetchWorkouts = async (): Promise<Workout[]> => {
  const response = await axios.get('http://localhost:8000/api/workouts/mine', {
    withCredentials: true,
  });
  return response.data;
};

const MyWorkoutsPage = () => {
  const { data: workouts = [], isLoading, error, refetch } = useQuery({
    queryKey: ['workouts'],
    queryFn: fetchWorkouts,
    retry: (failureCount, error) => {
      if (axios.isAxiosError(error) && (error.response?.status === 401 || error.response?.status === 403)) {
        return false;
      }
      return failureCount < 3;
    },
  });

  const getErrorMessage = (error: any) => {
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 401 || error.response?.status === 403) {
        return "Please log in to view your workouts.";
      }
      return "Failed to load workouts.";
    }
    return error instanceof Error ? error.message : "Failed to load workouts.";
  };

  if (isLoading) return <p>Loading workouts...</p>;
  if (error) return <p style={{ color: 'red' }}>{getErrorMessage(error)}</p>;

  return (
    <div>
      <h1>My Workouts</h1>
      <WorkoutForm onWorkoutCreated={() => refetch()} />
      {workouts.length === 0 ? (
        <p>You haven't logged any workouts yet.</p>
      ) : (
        <ul>
          {workouts.map(workout => (
            <li key={workout.id}>
              <h2>{workout.name || 'Unnamed Workout'}</h2>
              <p>Notes: {workout.notes || 'N/A'}</p>
              <p>Started: {new Date(workout.start_time).toLocaleString()}</p>
              {workout.end_time && <p>Ended: {new Date(workout.end_time).toLocaleString()}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default MyWorkoutsPage;