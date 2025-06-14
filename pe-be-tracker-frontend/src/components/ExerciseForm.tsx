import React from 'react';
import { useForm } from 'react-hook-form';
import { useMutation } from '@tanstack/react-query';
import axios from 'axios';
import { API_BASE_URL } from '../config';

interface ExerciseFormData {
  exercise_type_id: number;
  timestamp?: string;
  notes?: string;
}

interface ExerciseFormProps {
  workoutId: string;
  onExerciseCreated: () => void;
}

const createExercise = async (data: ExerciseFormData & { workout_id: number }) => {
  const response = await axios.post(
    `${API_BASE_URL}/api/exercises/`,
    {
      exercise_type_id: data.exercise_type_id,
      workout_id: data.workout_id,
      timestamp: data.timestamp ? new Date(data.timestamp).toISOString() : null,
      notes: data.notes || null,
    },
    { withCredentials: true }
  );
  return response.data;
};

const ExerciseForm: React.FC<ExerciseFormProps> = ({ workoutId, onExerciseCreated }) => {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ExerciseFormData>();

  const mutation = useMutation({
    mutationFn: (data: ExerciseFormData) => createExercise({ ...data, workout_id: Number(workoutId) }),
    onSuccess: () => {
      reset();
      onExerciseCreated();
    },
  });

  const onSubmit = (data: ExerciseFormData) => {
    mutation.mutate(data);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="mb-6 border border-gray-700 p-4 rounded-lg bg-gray-800 text-gray-100 shadow w-full max-w-lg mx-auto">
      <h2 className="text-lg font-semibold mb-4">Add Exercise</h2>
      <div className="mb-4">
        <label className="block mb-1 text-gray-200 font-medium">Exercise Type ID:
          <input
            type="number"
            {...register('exercise_type_id', { 
              required: 'Exercise type is required',
              valueAsNumber: true,
              min: { value: 1, message: 'Exercise type ID must be positive' }
            })}
            className="mt-1 mb-2 w-full bg-gray-700 text-gray-100 border border-gray-600 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </label>
        {errors.exercise_type_id && <div className="text-red-400 text-sm">{errors.exercise_type_id.message}</div>}
      </div>
      <div className="mb-4">
        <label className="block mb-1 text-gray-200 font-medium">Timestamp:
          <input
            type="datetime-local"
            {...register('timestamp')}
            className="mt-1 mb-2 w-full bg-gray-700 text-gray-100 border border-gray-600 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </label>
      </div>
      <div className="mb-4">
        <label className="block mb-1 text-gray-200 font-medium">Notes:
          <input
            type="text"
            {...register('notes')}
            className="mt-1 mb-2 w-full bg-gray-700 text-gray-100 border border-gray-600 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </label>
      </div>
      <button
        type="submit"
        disabled={mutation.isPending}
        className="bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded px-6 py-2 mt-2 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {mutation.isPending ? 'Adding...' : 'Add Exercise'}
      </button>
      {mutation.error && <div className="text-red-400 mt-3">Failed to create exercise.</div>}
    </form>
  );
};

export default ExerciseForm;
