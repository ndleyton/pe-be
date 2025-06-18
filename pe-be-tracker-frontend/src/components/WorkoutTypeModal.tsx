import React from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../api/client';
import { useGuestData, GuestWorkoutType } from '../contexts/GuestDataContext';

interface WorkoutType {
  id: number;
  name: string;
  description: string;
}

interface WorkoutTypeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (workoutType: WorkoutType | GuestWorkoutType) => void;
}

const fetchWorkoutTypes = async (): Promise<WorkoutType[]> => {
  const response = await api.get('/workout-types/');
  return response.data;
};

const WorkoutTypeModal: React.FC<WorkoutTypeModalProps> = ({ isOpen, onClose, onSelect }) => {
  const { data: guestData, isAuthenticated } = useGuestData();
  const { data: serverWorkoutTypes = [], isLoading, error } = useQuery({
    queryKey: ['workoutTypes'],
    queryFn: fetchWorkoutTypes,
    enabled: isAuthenticated(), // Only fetch when authenticated
  });

  // Use guest data if not authenticated, server data if authenticated
  const workoutTypes = isAuthenticated() ? serverWorkoutTypes : guestData.workoutTypes;

  const handleSelect = (workoutType: WorkoutType | GuestWorkoutType) => {
    onSelect(workoutType);
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const SkeletonCard = () => (
    <div className="bg-gray-800 rounded-lg p-4 border border-gray-600 animate-pulse">
      <div className="flex items-center space-x-3">
        <div className="w-10 h-10 bg-gray-700 rounded-lg"></div>
        <div className="flex-1">
          <div className="h-4 bg-gray-700 rounded w-3/4 mb-2"></div>
          <div className="h-3 bg-gray-700 rounded w-full"></div>
        </div>
      </div>
    </div>
  );

  const renderContent = () => {
    if (isAuthenticated() && isLoading) {
      return (
        <div className="grid gap-3">
          {Array.from({ length: 5 }).map((_, index) => (
            <SkeletonCard key={index} />
          ))}
        </div>
      );
    }

    if (isAuthenticated() && error) {
      return (
        <div className="text-center py-8">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-red-600 text-2xl">⚠</span>
          </div>
          <h4 className="text-white font-medium mb-2">Failed to load workout types</h4>
          <p className="text-gray-400 text-sm">Please try again later</p>
        </div>
      );
    }

    if (workoutTypes.length === 0) {
      return (
        <div className="text-center py-8">
          <div className="w-16 h-16 bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-gray-400 text-2xl">📋</span>
          </div>
          <h4 className="text-white font-medium mb-2">No workout types available</h4>
          <p className="text-gray-400 text-sm">{isAuthenticated() ? 'Contact support if this persists' : 'Guest workout types will be created automatically'}</p>
        </div>
      );
    }

    return (
      <div className="grid gap-3">
        {workoutTypes.map((workoutType) => (
          <div
            key={workoutType.id}
            onClick={() => handleSelect(workoutType)}
            className="bg-gray-800 rounded-lg p-4 cursor-pointer hover:bg-gray-700 transition-colors border border-gray-600"
          >
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold">
                  {workoutType.name.charAt(0)}
                </span>
              </div>
              <div className="flex-1">
                <h4 className="text-white font-medium">{workoutType.name}</h4>
                <p className="text-gray-400 text-sm mt-1">{workoutType.description}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
      onClick={handleBackdropClick}
    >
      <div className="bg-gray-900 rounded-lg p-6 max-w-2xl w-full max-h-96 overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-white">Select Workout Type</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        {renderContent()}
      </div>
    </div>
  );
};

export default WorkoutTypeModal;
export type { WorkoutType }; 