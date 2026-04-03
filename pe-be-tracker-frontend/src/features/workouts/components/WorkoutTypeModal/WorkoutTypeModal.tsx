
import { useQuery } from "@tanstack/react-query";
import api from "@/shared/api/client";
import { endpoints } from "@/shared/api/endpoints";
import { useGuestStore, useAuthStore, GuestWorkoutType } from "@/stores";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/shared/components/ui/dialog";
import React from "react";

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
            className="bg-card/40 hover:bg-accent border-border cursor-pointer rounded-xl border p-4 transition-all hover:scale-[1.01] active:scale-[0.99] backdrop-blur-sm"
          >
            <div className="flex items-center space-x-4">
              <div className="bg-primary/15 text-primary flex h-12 w-12 shrink-0 items-center justify-center rounded-xl font-bold text-xl">
                {workoutType.name.charAt(0)}
              </div>
              <div className="flex-1 text-left">
                <h4 className="text-foreground font-semibold text-base">
                  {workoutType.name}
                </h4>
                <p className="text-muted-foreground mt-1 text-sm leading-snug">
                  {workoutType.description}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Select Workout Type</DialogTitle>
        </DialogHeader>
        <div className="mt-4">
          {renderContent()}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default WorkoutTypeModal;
export type { WorkoutType };
