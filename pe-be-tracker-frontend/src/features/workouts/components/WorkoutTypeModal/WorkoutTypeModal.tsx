import React from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/shared/api/client';
import { endpoints } from '@/shared/api/endpoints';
import { useGuestData, GuestWorkoutType } from '@/contexts/GuestDataContext';

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
  const response = await api.get(endpoints.workoutTypes);
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
  const workoutTypes = isAuthenticated() 
    ? (Array.isArray(serverWorkoutTypes) ? serverWorkoutTypes : [])
    : (Array.isArray(guestData.workoutTypes) ? guestData.workoutTypes : []);

  const handleSelect = (workoutType: WorkoutType | GuestWorkoutType) => {
    onSelect(workoutType);
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const SkeletonCard = () => (
    <div className="bg-card rounded-lg p-4 border border-border animate-pulse">
      <div className="flex items-center space-x-3">
        <div className="w-10 h-10 bg-muted rounded-lg"></div>
        <div className="flex-1">
          <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
          <div className="h-3 bg-muted rounded w-full"></div>
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
          <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-destructive text-2xl">⚠</span>
          </div>
          <h4 className="text-foreground font-medium mb-2">Failed to load workout types</h4>
          <p className="text-muted-foreground text-sm">Please try again later</p>
        </div>
      );
    }

    if (workoutTypes.length === 0) {
      return (
        <div className="text-center py-8">
          <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-muted-foreground text-2xl">📋</span>
          </div>
          <h4 className="text-foreground font-medium mb-2">No workout types available</h4>
          <p className="text-muted-foreground text-sm">{isAuthenticated() ? 'Contact support if this persists' : 'Guest workout types will be created automatically'}</p>
        </div>
      );
    }

    return (
      <div className="grid gap-3">
        {workoutTypes.map((workoutType) => (
          <div
            key={workoutType.id}
            onClick={() => handleSelect(workoutType)}
            className="bg-card rounded-lg p-4 cursor-pointer hover:bg-accent transition-colors border border-border"
          >
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
                <span className="text-primary-foreground font-bold">
                  {workoutType.name.charAt(0)}
                </span>
              </div>
              <div className="flex-1">
                <h4 className="text-foreground font-medium">{workoutType.name}</h4>
                <p className="text-muted-foreground text-sm mt-1">{workoutType.description}</p>
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
      className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
      onClick={handleBackdropClick}
    >
      <div className="bg-background rounded-lg p-6 max-w-2xl w-full max-h-96 overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-foreground">Select Workout Type</h3>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
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