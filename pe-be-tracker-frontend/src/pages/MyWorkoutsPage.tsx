import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import WorkoutForm from '../components/WorkoutForm';
import HomeLogo from '../components/HomeLogo';

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
  const navigate = useNavigate();
  const { data: workouts = [], isLoading, error, refetch } = useQuery({
    queryKey: ['workouts'],
    queryFn: fetchWorkouts,
    retry: (failureCount, error: unknown) => {
      if (axios.isAxiosError(error) && (error.response?.status === 401 || error.response?.status === 403)) {
        return false;
      }
      return failureCount < 3;
    },
  });

  const getErrorMessage = (error: unknown) => {
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 401 || error.response?.status === 403) {
        return "Please log in to view your workouts.";
      }
      return "Failed to load workouts.";
    }
    return error instanceof Error ? error.message : "Failed to load workouts.";
  };

  const formatDuration = (startTime: string, endTime: string | null) => {
    if (!endTime) return "In Progress";
    
    const start = new Date(startTime);
    const end = new Date(endTime);
    const durationMs = end.getTime() - start.getTime();
    const durationMinutes = Math.floor(durationMs / (1000 * 60));
    const hours = Math.floor(durationMinutes / 60);
    const minutes = durationMinutes % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}`;
    }
    return `0:${minutes.toString().padStart(2, '0')}`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'numeric', 
      day: 'numeric', 
      year: '2-digit' 
    });
  };

  const handleWorkoutClick = (workoutId: number) => {
    navigate(`/workout/${workoutId}`);
  };

  if (isLoading) return <p>Loading workouts...</p>;
  
  if (error) {
    const errorMessage = getErrorMessage(error);
    const isAuthError = axios.isAxiosError(error) && (error.response?.status === 401 || error.response?.status === 403);
    
    if (isAuthError) {
      return (
        <div className="min-h-screen flex flex-col bg-base-200">
          <div className="p-4">
            <HomeLogo />
          </div>
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-red-600 text-2xl">⚠</span>
              </div>
              <h2 className="text-xl font-semibold mb-2">Session Expired</h2>
              <p className="text-gray-600 mb-4">{errorMessage}</p>
              <p className="text-sm text-gray-500">Click the logo above to return to login</p>
            </div>
          </div>
        </div>
      );
    }
    
    return <p style={{ color: 'red' }}>{errorMessage}</p>;
  }

  return (
    <div className="min-h-screen bg-base-200">
      <div className="p-4">
        <HomeLogo />
        <div className="max-w-4xl mx-auto">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold">Workouts</h1>
            <button className="text-primary hover:text-primary-focus">Show More</button>
          </div>
          
          <WorkoutForm onWorkoutCreated={() => refetch()} />
          
          {workouts.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500">You haven't logged any workouts yet.</p>
            </div>
          ) : (
            <div className="space-y-3 mt-6">
              {workouts.map(workout => (
                <div
                  key={workout.id}
                  onClick={() => handleWorkoutClick(workout.id)}
                  className="bg-gray-800 rounded-lg p-4 flex items-center justify-between cursor-pointer hover:bg-gray-700 transition-colors"
                >
                  <div className="flex items-center space-x-4">
                    <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
                      <span className="text-white font-bold text-lg">💪</span>
                    </div>
                    <div>
                      <h3 className="text-white font-medium">
                        {workout.name || 'Traditional Strength Training'}
                      </h3>
                      <div className="flex items-center space-x-4 mt-1">
                        <span className="text-green-400 font-mono text-lg">
                          {formatDuration(workout.start_time, workout.end_time)}
                        </span>
                        <span className="text-gray-400 text-sm">
                          {formatDate(workout.start_time)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="text-gray-400">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MyWorkoutsPage;