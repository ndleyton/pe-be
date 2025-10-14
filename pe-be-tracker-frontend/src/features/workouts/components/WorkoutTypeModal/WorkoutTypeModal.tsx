import React from "react";
import { useQuery } from "@tanstack/react-query";
import api from "@/shared/api/client";
import { endpoints } from "@/shared/api/endpoints";
import { useGuestStore, useAuthStore, GuestWorkoutType } from "@/stores";

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

const WorkoutTypeModal: React.FC<WorkoutTypeModalProps> = ({
  isOpen,
  onClose,
  onSelect,
}) => {
  // Get state from stores
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const guestData = useGuestStore();
  const {
    data: serverWorkoutTypes = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["workoutTypes"],
    queryFn: fetchWorkoutTypes,
    enabled: isAuthenticated, // Only fetch when authenticated
  });

  // Use guest data if not authenticated, server data if authenticated
  const workoutTypes = isAuthenticated
    ? Array.isArray(serverWorkoutTypes)
      ? serverWorkoutTypes
      : []
    : Array.isArray(guestData.workoutTypes)
      ? guestData.workoutTypes
      : [];

  const handleSelect = (workoutType: WorkoutType | GuestWorkoutType) => {
    onSelect(workoutType);
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const SkeletonCard = () => (
    <div className="bg-card border-border animate-pulse rounded-lg border p-4">
      <div className="flex items-center space-x-3">
        <div className="bg-muted h-10 w-10 rounded-lg"></div>
        <div className="flex-1">
          <div className="bg-muted mb-2 h-4 w-3/4 rounded"></div>
          <div className="bg-muted h-3 w-full rounded"></div>
        </div>
      </div>
    </div>
  );

  const renderContent = () => {
    if (isAuthenticated && isLoading) {
      return (
        <div className="grid gap-3">
          {Array.from({ length: 5 }).map((_, index) => (
            <SkeletonCard key={index} />
          ))}
        </div>
      );
    }

    if (isAuthenticated && error) {
      return (
        <div className="py-8 text-center">
          <div className="bg-destructive/10 mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full">
            <span className="text-destructive text-2xl">⚠</span>
          </div>
          <h4 className="text-foreground mb-2 font-medium">
            Failed to load workout types
          </h4>
          <p className="text-muted-foreground text-sm">
            Please try again later
          </p>
        </div>
      );
    }

    if (workoutTypes.length === 0) {
      return (
        <div className="py-8 text-center">
          <div className="bg-muted mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full">
            <span className="text-muted-foreground text-2xl">📋</span>
          </div>
          <h4 className="text-foreground mb-2 font-medium">
            No workout types available
          </h4>
          <p className="text-muted-foreground text-sm">
            {isAuthenticated
              ? "Contact support if this persists"
              : "Guest workout types will be created automatically"}
          </p>
        </div>
      );
    }

    return (
      <div className="grid gap-3">
        {workoutTypes.map((workoutType) => (
          <div
            key={workoutType.id}
            onClick={() => handleSelect(workoutType)}
            className="bg-card hover:bg-accent border-border cursor-pointer rounded-lg border p-4 transition-colors"
          >
            <div className="flex items-center space-x-3">
              <div className="bg-primary flex h-10 w-10 items-center justify-center rounded-lg">
                <span className="text-primary-foreground font-bold">
                  {workoutType.name.charAt(0)}
                </span>
              </div>
              <div className="flex-1">
                <h4 className="text-foreground font-medium">
                  {workoutType.name}
                </h4>
                <p className="text-muted-foreground mt-1 text-sm">
                  {workoutType.description}
                </p>
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={handleBackdropClick}
    >
      <div className="bg-background max-h-[36rem] w-full max-w-2xl overflow-y-auto rounded-lg p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-foreground text-lg font-semibold">
            Select Workout Type
          </h3>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
          >
            <svg
              className="h-6 w-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
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
