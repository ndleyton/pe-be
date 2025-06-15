import React, { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import { toUTCISOString } from '../utils/date';
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
  const response = await api.post(
    '/workouts/',
    {
      name: data.name || null,
      notes: data.notes || null,
      start_time: data.start_time ? toUTCISOString(data.start_time) : null,
      end_time: data.end_time ? toUTCISOString(data.end_time) : null,
      workout_type_id: data.workout_type_id,
    },
  );
  return response.data;
};

const WorkoutForm: React.FC<WorkoutFormProps> = ({ onWorkoutCreated }) => {
  const navigate = useNavigate();
  const [showModal, setShowModal] = useState(false);
  const [selectedWorkoutType, setSelectedWorkoutType] = useState<WorkoutType | null>(null);
  const [isEditingName, setIsEditingName] = useState(false);
  
  const {
    register,
    handleSubmit,
    reset,
    formState,
    setValue,
    watch,
  } = useForm<WorkoutFormData>({
    defaultValues: {
      name: new Date().toISOString().slice(0, 10),
      start_time: new Date().toISOString().slice(0, 16),
    },
  });

  const workoutTypeId = watch('workout_type_id');
  const nameField = watch('name');

  const datePrefix = useMemo(() => new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), []);

  useEffect(() => {
    if (selectedWorkoutType && (!formState.dirtyFields.name || nameField === datePrefix)) {
      setValue('name', `${selectedWorkoutType.name} - ${datePrefix}`);
    }
  }, [selectedWorkoutType, datePrefix, formState.dirtyFields.name, nameField, setValue]);

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
    setIsEditingName(false);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="mb-6 border border-gray-700 p-6 rounded-lg bg-gray-900 text-gray-100 shadow-lg w-full max-w-md mx-auto">
      <div className="mb-6">
        {isEditingName ? (
          <div className="flex items-center space-x-2">
            <input
              type="text"
              {...register('name')}
              className="flex-1 bg-gray-800 text-gray-100 border border-gray-600 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
            <button
              type="button"
              onClick={() => setIsEditingName(false)}
              className="bg-green-600 hover:bg-green-700 text-white p-2 rounded focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </button>
          </div>
        ) : (
          <div
            onClick={() => setIsEditingName(true)}
            className="flex items-center justify-between cursor-pointer group"
          >
            <h2 className="text-xl font-semibold text-gray-100">{nameField || 'Workout Name'}</h2>
            <svg className="w-4 h-4 text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          </div>
        )}
      </div>
      <div className="mb-4">
        <label className="block mb-1 text-gray-200 font-medium">Notes:
          <input
            placeholder="How am I feeling today?"
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
        {formState.errors.start_time && <div className="text-red-400 text-sm">{formState.errors.start_time.message}</div>}
      </div>
      <div className="mb-4">
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
        {formState.errors.workout_type_id && <div className="text-red-400 text-sm mt-2">{formState.errors.workout_type_id.message}</div>}
      </div>
      <button
        type="submit"
        disabled={mutation.isPending}
        className="bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded px-6 py-2 mt-2 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {mutation.isPending ? 'Creating...' : 'Start Workout'}
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
