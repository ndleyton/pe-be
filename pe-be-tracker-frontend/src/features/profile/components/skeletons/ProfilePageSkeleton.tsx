import React from 'react';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { WeekTrackingSkeleton } from '@/shared/components/skeletons/WeekTrackingSkeleton';

const ProfilePageSkeleton: React.FC = () => (
  <div className="max-w-5xl mx-auto p-8 text-center">
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Profile</h1>
        <p className="text-muted-foreground mt-1">Track your fitness journey</p>
      </div>

      <WeekTrackingSkeleton className="mb-6" />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-card rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <Skeleton className="h-4 w-24 mb-2" />
                <Skeleton className="h-8 w-12" />
              </div>
              <Skeleton className="w-12 h-12 rounded-full" />
            </div>
          </div>
        ))}
      </div>

      <div className="bg-card rounded-lg p-6 text-center">
        <h2 className="text-lg font-semibold mb-4">Account Information</h2>
        <div className="space-y-4 flex flex-col items-center">
          <div>
            <Skeleton className="h-4 w-12 mb-1" />
            <Skeleton className="h-5 w-20" />
          </div>
          <div>
            <Skeleton className="h-4 w-16 mb-1" />
            <Skeleton className="h-10 w-32" />
          </div>
        </div>
      </div>

      <div className="flex justify-center py-4">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    </div>
  </div>
);

export default ProfilePageSkeleton;

