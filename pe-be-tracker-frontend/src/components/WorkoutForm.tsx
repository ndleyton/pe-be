import React, { useState } from 'react';
import axios from 'axios';

interface WorkoutFormProps {
  onWorkoutCreated: () => void;
}

const WorkoutForm: React.FC<WorkoutFormProps> = ({ onWorkoutCreated }) => {
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
      await axios.post(
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
      setName('');
      setNotes('');
      setStartTime('');
      setEndTime('');
      setWorkoutTypeId('');
      onWorkoutCreated();
    } catch (err) {
      setError('Failed to create workout.');
    } finally {
      setLoading(false);
    }
  };

  // Dark mode styles
  const formStyle: React.CSSProperties = {
    marginBottom: 24,
    border: '1px solid #444',
    padding: 16,
    borderRadius: 8,
    background: '#181a1b',
    color: '#f3f4f6',
    boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
  };
  const labelStyle: React.CSSProperties = {
    display: 'block',
    marginBottom: 4,
    color: '#f3f4f6',
    fontWeight: 500
  };
  const inputStyle: React.CSSProperties = {
    background: '#23272a',
    color: '#f3f4f6',
    border: '1px solid #555',
    borderRadius: 4,
    padding: '6px 10px',
    marginTop: 2,
    marginBottom: 8,
    width: '100%'
  };
  const buttonStyle: React.CSSProperties = {
    background: '#2563eb',
    color: '#fff',
    border: 'none',
    borderRadius: 4,
    padding: '8px 16px',
    fontWeight: 600,
    cursor: 'pointer',
    marginTop: 8
  };

  return (
    <form onSubmit={handleSubmit} style={formStyle}>
      <h3 style={{ color: '#f3f4f6' }}>Create Workout</h3>
      <div style={{ marginBottom: 8 }}>
        <label style={labelStyle}>Name:
          <input type="text" value={name} onChange={e => setName(e.target.value)} style={inputStyle} />
        </label>
      </div>
      <div style={{ marginBottom: 8 }}>
        <label style={labelStyle}>Notes:
          <input type="text" value={notes} onChange={e => setNotes(e.target.value)} style={inputStyle} />
        </label>
      </div>
      <div style={{ marginBottom: 8 }}>
        <label style={labelStyle}>Start Time:
          <input type="datetime-local" value={startTime} onChange={e => setStartTime(e.target.value)} required style={inputStyle} />
        </label>
      </div>
      <div style={{ marginBottom: 8 }}>
        <label style={labelStyle}>End Time:
          <input type="datetime-local" value={endTime} onChange={e => setEndTime(e.target.value)} style={inputStyle} />
        </label>
      </div>
      <div style={{ marginBottom: 8 }}>
        <label style={labelStyle}>Workout Type ID:
          <input type="number" value={workoutTypeId} onChange={e => setWorkoutTypeId(e.target.value)} required style={inputStyle} />
        </label>
      </div>
      <button type="submit" disabled={loading} style={buttonStyle}>{loading ? 'Creating...' : 'Create Workout'}</button>
      {error && <div style={{ color: '#f87171', marginTop: 8 }}>{error}</div>}
    </form>
  );
};

export default WorkoutForm;
