import React, { useState, useEffect } from 'react';
import axios from 'axios'; 

type Workout = {
  id: number;
  name: string | null;
  notes: string | null;
  start_time: string;
  end_time: string | null;
}

const MyWorkoutsPage = () => {
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchWorkouts = async () => {
            try {
                // Ensure axios sends cookies with the request
                const response = await axios.get('http://localhost:8000/api/workouts/mine', {
                    withCredentials: true, // IMPORTANT for sending session cookies
                });
                setWorkouts(response.data);
                setError(null);
            } catch (err) {
                console.error("Error fetching workouts:", err);
                if (axios.isAxiosError(err)) {
                    if (err.response && (err.response.status === 401 || err.response.status === 403)) {
                        setError("Please log in to view your workouts.");
                        // Optionally, redirect to login: window.location.href = '/';
                    } else {
                        setError("Failed to load workouts.");
                    }
                } else if (err instanceof Error) {
                    setError(err.message);
                } else {
                    setError("Failed to load workouts.");
                }
            } finally {
                setLoading(false);
            }
        };

        fetchWorkouts();
    }, []);

    if (loading) return <p>Loading workouts...</p>;
    if (error) return <p style={{ color: 'red' }}>{error}</p>;

    return (
        <div>
            <h1>My Workouts</h1>
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