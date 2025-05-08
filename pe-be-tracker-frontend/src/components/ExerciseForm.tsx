import React, { useState } from 'react';
import axios from 'axios';

interface ExerciseFormProps {
  workoutId: string;
  onExerciseCreated: () => void;
}

const ExerciseForm: React.FC<ExerciseFormProps> = ({ workoutId, onExerciseCreated }) => {
  const [exerciseTypeId, setExerciseTypeId] = useState('');
  const [timestamp, setTimestamp] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await axios.post(
        'http://localhost:8000/api/exercises/',
        {
          exercise_type_id: Number(exerciseTypeId),
          workout_id: Number(workoutId),
          timestamp: timestamp ? new Date(timestamp).toISOString() : null,
          notes: notes || null,
        },
        { withCredentials: true }
      );
      setExerciseTypeId('');
      setTimestamp('');
      setNotes('');
      onExerciseCreated();
    } catch (err) {
      setError('Failed to create exercise.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mb-6 border border-gray-700 p-4 rounded-lg bg-gray-800 text-gray-100 shadow w-full max-w-lg mx-auto">
      <h2 className="text-lg font-semibold mb-4">Add Exercise</h2>
      <div className="mb-4">
        <label className="block mb-1 text-gray-200 font-medium">Exercise Type ID:
          <input
            type="number"
            value={exerciseTypeId}
            onChange={e => setExerciseTypeId(e.target.value)}
            required
            className="mt-1 mb-2 w-full bg-gray-700 text-gray-100 border border-gray-600 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </label>
      </div>
      <div className="mb-4">
        <label className="block mb-1 text-gray-200 font-medium">Timestamp:
          <input
            type="datetime-local"
            value={timestamp}
            onChange={e => setTimestamp(e.target.value)}
            className="mt-1 mb-2 w-full bg-gray-700 text-gray-100 border border-gray-600 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </label>
      </div>
      <div className="mb-4">
        <label className="block mb-1 text-gray-200 font-medium">Notes:
          <input
            type="text"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            className="mt-1 mb-2 w-full bg-gray-700 text-gray-100 border border-gray-600 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </label>
      </div>
      <button
        type="submit"
        disabled={loading}
        className="bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded px-6 py-2 mt-2 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? 'Adding...' : 'Add Exercise'}
      </button>
      {error && <div className="text-red-400 mt-3">{error}</div>}
    </form>
  );
};

export default ExerciseForm;
