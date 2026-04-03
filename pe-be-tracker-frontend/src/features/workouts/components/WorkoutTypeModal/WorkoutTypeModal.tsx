
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

export const fetchWorkoutTypes = async (): Promise<WorkoutType[]> => {
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
        <div className="py-10 text-center">
          <div className="bg-destructive/10 mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full">
            <span className="text-destructive text-2xl text-center">⚠</span>
          </div>
          <h4 className="text-foreground mb-2 font-semibold">
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
        <div className="py-10 text-center">
          <div className="bg-muted mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full">
            <span className="text-muted-foreground text-2xl text-center">📋</span>
          </div>
          <h4 className="text-foreground mb-2 font-semibold">
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
      <div className="grid gap-3 p-1">
        {workoutTypes.map((workoutType) => (
          <button
            key={workoutType.id}
            onClick={() => handleSelect(workoutType)}
            className="group relative flex w-full items-center space-x-4 overflow-hidden rounded-2xl border border-border/50 bg-card/60 p-4 text-left transition-all hover:scale-[1.02] hover:bg-accent/60 hover:border-primary/40 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            {/* Subtle decoration */}
            <div className="absolute -right-4 -top-4 h-16 w-16 rounded-full bg-primary/10 opacity-0 transition-opacity group-hover:opacity-100" />

            <div className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-primary/15 text-primary font-bold text-xl shadow-inner group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-300">
              <div className="absolute inset-x-0 bottom-0 top-0 bg-gradient-to-tr from-primary/30 to-transparent group-hover:opacity-0 transition-opacity" />
              <span className="relative z-10">{workoutType.name.charAt(0)}</span>
            </div>
            <div className="flex-1 overflow-hidden">
              <h4 className="truncate text-foreground font-bold text-base group-hover:text-primary transition-colors">
                {workoutType.name}
              </h4>
              <p className="text-muted-foreground mt-0.5 line-clamp-1 text-xs font-medium leading-normal opacity-70 group-hover:opacity-100">
                {workoutType.description}
              </p>
            </div>
            <div className="text-muted-foreground opacity-30 transition-all group-hover:translate-x-1 group-hover:opacity-100 group-hover:text-primary">
              <svg
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </div>
          </button>
        ))}
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="max-h-[85vh] overflow-y-auto sm:max-w-md border-border/40"
        hideOverlay={true}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader className="pb-2">
          <DialogTitle className="text-xl font-bold tracking-tight">Select Workout Type</DialogTitle>
        </DialogHeader>
        <div className="mt-2 space-y-3">
          {renderContent()}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default WorkoutTypeModal;
export type { WorkoutType };
