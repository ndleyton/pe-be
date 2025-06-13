import React from 'react';
import { useForm } from 'react-hook-form';
import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

interface WorkoutFormData {
  name?: string;
  notes?: string;
  start_time: string;
  end_time?: string;
  workout_type_id: number;
}

interface WorkoutFormProps {
  onWorkoutCreated: (newWorkoutId: number) => void;
}

const createWorkout = async (data: WorkoutFormData) => {
  const response = await axios.post(
    'http://localhost:8000/api/workouts/',
    {
      name: data.name || null,
      notes: data.notes || null,
      start_time: data.start_time ? new Date(data.start_time).toISOString() : null,
      end_time: data.end_time ? new Date(data.end_time).toISOString() : null,
      workout_type_id: data.workout_type_id,
    },
    {
      withCredentials: true,
    }
  );
  return response.data;
};

const WorkoutForm: React.FC<WorkoutFormProps> = ({ onWorkoutCreated }) => {
  const navigate = useNavigate();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<WorkoutFormData>({
    defaultValues: {
      start_time: new Date().toISOString().slice(0, 16)
    }
  });

  const mutation = useMutation({
    mutationFn: createWorkout,
    onSuccess: (data) => {
      const newWorkoutId = data.id;
      reset();
      onWorkoutCreated(newWorkoutId);
      navigate(`/workout/${newWorkoutId}`);
    },
  });

  const onSubmit = (data: WorkoutFormData) => {
    mutation.mutate(data);
  };




  return (
    <form onSubmit={handleSubmit(onSubmit)} className="mb-6 border border-gray-700 p-6 rounded-lg bg-gray-900 text-gray-100 shadow-lg w-full max-w-md mx-auto">
      <h3 className="text-lg font-semibold mb-4 text-gray-100">Create Workout</h3>
      <div className="mb-4">
        <label className="block mb-1 text-gray-200 font-medium">Name:
          <input
            type="text"
            {...register('name')}
            className="mt-1 mb-2 w-full bg-gray-800 text-gray-100 border border-gray-600 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </label>
      </div>
      <div className="mb-4">
        <label className="block mb-1 text-gray-200 font-medium">Notes:
          <input
            type="text"
            {...register('notes')}
            className="mt-1 mb-2 w-full bg-gray-800 text-gray-100 border border-gray-600 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </label>
      </div>
      <div className="mb-4">
        <label className="block mb-1 text-gray-200 font-medium">Start Time:
          <input
            type="datetime-local"
            {...register('start_time', { required: 'Start time is required' })}
            className="mt-1 mb-2 w-full bg-gray-800 text-gray-100 border border-gray-600 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </label>
        {errors.start_time && <div className="text-red-400 text-sm">{errors.start_time.message}</div>}
      </div>
      <div className="mb-4">
        <label className="block mb-1 text-gray-200 font-medium">Workout Type ID:
          <input
            type="number"
            {...register('workout_type_id', { 
              required: 'Workout type is required',
              valueAsNumber: true,
              min: { value: 1, message: 'Workout type ID must be positive' }
            })}
            className="mt-1 mb-2 w-full bg-gray-800 text-gray-100 border border-gray-600 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </label>
        {errors.workout_type_id && <div className="text-red-400 text-sm">{errors.workout_type_id.message}</div>}
      </div>
      <button
        type="submit"
        disabled={mutation.isPending}
        className="bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded px-6 py-2 mt-2 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {mutation.isPending ? 'Creating...' : 'Create Workout'}
      </button>
      {mutation.error && <div className="text-red-400 mt-3">Failed to create workout.</div>}
    </form>
  );
};

export default WorkoutForm;
