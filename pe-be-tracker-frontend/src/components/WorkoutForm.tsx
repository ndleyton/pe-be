import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import WorkoutTypeModal, { WorkoutType } from './WorkoutTypeModal';

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
  const [showModal, setShowModal] = useState(false);
  const [selectedWorkoutType, setSelectedWorkoutType] = useState<WorkoutType | null>(null);
  
  const {
    register,
    handleSubmit,
    reset,
    setValue,
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
      resetForm();
      onWorkoutCreated(newWorkoutId);
      navigate(`/workout/${newWorkoutId}`);
    },
  });

  const onSubmit = (data: WorkoutFormData) => {
    mutation.mutate(data);
  };

  const handleWorkoutTypeSelect = (workoutType: WorkoutType) => {
    setSelectedWorkoutType(workoutType);
    setValue('workout_type_id', workoutType.id);
    setShowModal(false);
  };

  const resetForm = () => {
    reset();
    setSelectedWorkoutType(null);
  };




  return (
    <form role="form" onSubmit={handleSubmit(onSubmit)} className="mb-6 border border-gray-700 p-6 rounded-lg bg-gray-900 text-gray-100 shadow-lg w-full max-w-md mx-auto">
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
        <label className="block mb-1 text-gray-200 font-medium">Workout Type:</label>
        {selectedWorkoutType ? (
          <div 
            onClick={() => setShowModal(true)}
            className="bg-gray-800 rounded-lg p-4 border border-gray-600 cursor-pointer hover:bg-gray-700 transition-colors"
          >
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold">
                  {selectedWorkoutType.name.charAt(0)}
                </span>
              </div>
              <div className="flex-1">
                <h4 className="text-white font-medium">{selectedWorkoutType.name}</h4>
                <p className="text-gray-400 text-sm mt-1">{selectedWorkoutType.description}</p>
              </div>
              <div className="text-gray-400">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </div>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="w-full bg-gray-800 text-gray-100 border border-gray-600 rounded px-3 py-2 text-left hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            Select Workout Type
          </button>
        )}
        <input
          type="hidden"
          {...register('workout_type_id', { 
            required: 'Workout type is required',
            valueAsNumber: true,
          })}
        />
        {errors.workout_type_id && <div className="text-red-400 text-sm mt-2">{errors.workout_type_id.message}</div>}
      </div>
      <button
        type="submit"
        disabled={mutation.isPending}
        className="bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded px-6 py-2 mt-2 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {mutation.isPending ? 'Creating...' : 'Create Workout'}
      </button>
      {mutation.error && <div className="text-red-400 mt-3">Failed to create workout.</div>}
      
      <WorkoutTypeModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSelect={handleWorkoutTypeSelect}
      />
    </form>
  );
};

export default WorkoutForm;
