import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

interface WorkoutFormProps {
  onWorkoutCreated: (newWorkoutId: number) => void;
}

const WorkoutForm: React.FC<WorkoutFormProps> = ({ onWorkoutCreated }) => {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [workoutTypeId, setWorkoutTypeId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const response = await axios.post(
        'http://localhost:8000/api/workouts/',
        {
          name: name || null,
          notes: notes || null,
          start_time: startTime ? new Date(startTime).toISOString() : null,
          end_time: endTime ? new Date(endTime).toISOString() : null,
          workout_type_id: Number(workoutTypeId),
        },
        {
          withCredentials: true,
        }
      );
      const newWorkoutId = response.data.id;
      setName('');
      setNotes('');
      setStartTime('');
      setEndTime('');
      setWorkoutTypeId('');
      onWorkoutCreated(newWorkoutId);
      navigate(`/workout/${newWorkoutId}`);
    } catch (err) {
      setError('Failed to create workout.');
    } finally {
      setLoading(false);
    }
  };




  return (
    <form onSubmit={handleSubmit} className="mb-6 border border-gray-700 p-6 rounded-lg bg-gray-900 text-gray-100 shadow-lg w-full max-w-md mx-auto">
      <h3 className="text-lg font-semibold mb-4 text-gray-100">Create Workout</h3>
      <div className="mb-4">
        <label className="block mb-1 text-gray-200 font-medium">Name:
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            className="mt-1 mb-2 w-full bg-gray-800 text-gray-100 border border-gray-600 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </label>
      </div>
      <div className="mb-4">
        <label className="block mb-1 text-gray-200 font-medium">Notes:
          <input
            type="text"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            className="mt-1 mb-2 w-full bg-gray-800 text-gray-100 border border-gray-600 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </label>
      </div>
      <div className="mb-4">
        <label className="block mb-1 text-gray-200 font-medium">Start Time:
          <input
            type="datetime-local"
            value={startTime}
            onChange={e => setStartTime(e.target.value)}
            required
            className="mt-1 mb-2 w-full bg-gray-800 text-gray-100 border border-gray-600 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </label>
      </div>
      <div className="mb-4">
        <label className="block mb-1 text-gray-200 font-medium">End Time:
          <input
            type="datetime-local"
            value={endTime}
            onChange={e => setEndTime(e.target.value)}
            className="mt-1 mb-2 w-full bg-gray-800 text-gray-100 border border-gray-600 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </label>
      </div>
      <div className="mb-4">
        <label className="block mb-1 text-gray-200 font-medium">Workout Type ID:
          <input
            type="number"
            value={workoutTypeId}
            onChange={e => setWorkoutTypeId(e.target.value)}
            required
            className="mt-1 mb-2 w-full bg-gray-800 text-gray-100 border border-gray-600 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </label>
      </div>
      <button
        type="submit"
        disabled={loading}
        className="bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded px-6 py-2 mt-2 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? 'Creating...' : 'Create Workout'}
      </button>
      {error && <div className="text-red-400 mt-3">{error}</div>}
    </form>
  );
};

export default WorkoutForm;
