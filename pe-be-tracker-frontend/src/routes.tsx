import React, { Suspense } from 'react';
import { type RouteObject } from 'react-router-dom';

import { PageErrorBoundary } from '@/shared/components/error';
import SimplePageWrapper from '@/shared/components/wrappers/SimplePageWrapper';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { DEFAULT_SKELETON_COUNT } from '@/shared/constants';

import App from './App';
import AppLayout from './layouts/AppLayout';
import NotFoundPage from './pages/NotFoundPage';

// These pages bear no lazy loading as they are core pages
import { MyWorkoutsPage } from './features/workouts/pages';
import { ChatPage } from './features/chat/pages';

// Lazy load other components with error boundaries
const WorkoutPage = React.lazy(() =>
  import('./features/workouts/pages').then((m) => ({ default: m.WorkoutPage })),
);
const ExerciseTypesPage = React.lazy(() =>
  import('./features/exercises/pages').then((m) => ({ default: m.ExerciseTypesPage })),
);
const ExerciseTypeDetailsPage = React.lazy(() =>
  import('./features/exercises/pages').then((m) => ({ default: m.ExerciseTypeDetailsPage })),
);
const RoutinesPage = React.lazy(() => import('./features/routines/pages/RoutinesPage'));
const RoutineDetailsPage = React.lazy(() => import('./features/routines/pages/RoutineDetailsPage'));
const ProfilePage = React.lazy(() =>
  import('./features/profile/pages').then((m) => ({ default: m.ProfilePage })),
);
const AboutPage = React.lazy(() =>
  import('./features/about/pages').then((m) => ({ default: m.AboutPage })),
);
const OAuthCallbackPage = React.lazy(() =>
  import('./features/auth/pages').then((m) => ({ default: m.OAuthCallbackPage })),
);

// Enhanced loading component with reduced CLS and accessibility
const LoadingFallback = () => (
  <div className="flex items-center justify-center min-h-[60vh]" aria-busy="true" aria-live="polite">
    <div className="w-full max-w-4xl px-6">
      {/* Page title skeleton */}
      <Skeleton className="h-8 w-48 mb-6 mx-auto" />
      {/* Content skeleton grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Array.from({ length: DEFAULT_SKELETON_COUNT }).map((_, i) => (
          <div key={i} className="bg-card rounded-lg p-4 border border-border">
            <div className="flex items-start gap-4">
              <Skeleton className="h-10 w-10 rounded" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-5 w-2/3" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
              </div>
            </div>
          </div>
        ))}
      </div>
      {/* Keep a spinner for SR and visual cue */}
      <div className="flex justify-center py-4" role="status">
        <div className="loading loading-spinner loading-lg" aria-label="Loading"></div>
      </div>
    </div>
  </div>
);

// ExerciseTypesPage-specific loading fallback that matches its structure
const ExerciseTypesPageFallback = () => (
  <div className="max-w-5xl mx-auto p-8 text-center">
    <div className="mb-6">
      <h1 className="text-3xl font-bold mb-4">Exercise Types</h1>
      
      {/* Search and Filter Controls */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Skeleton className="h-10 w-full rounded-md" />
        </div>
        <Skeleton className="h-10 w-full sm:w-32 rounded-md" />
      </div>
    </div>

    {/* Exercise Types Grid with skeletons */}
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {/* Keep spinner for tests */}
      <div className="col-span-full flex justify-center py-4">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
      {Array.from({ length: 9 }).map((_, i) => (
        <div key={i} className="bg-card rounded-lg p-4 border border-border">
          <div className="flex items-start gap-4">
            <Skeleton className="h-12 w-12 rounded" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <Skeleton className="h-7 w-20 rounded-full" />
            <Skeleton className="h-7 w-28 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  </div>
);

// ProfilePage-specific loading fallback that matches its structure
const ProfilePageFallback = () => (
  <div className="max-w-5xl mx-auto p-8 text-center">
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Profile</h1>
        <p className="text-muted-foreground mt-1">Track your fitness journey</p>
      </div>
      
      {/* WeekTracking Skeleton */}
      <div className="bg-base-100 rounded-lg p-4 mb-6">
        <h3 className="text-sm font-medium text-base-content/70 mb-3">Week Activity</h3>
        <div className="flex justify-between items-center gap-1">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="flex flex-col items-center gap-1">
              <span className="text-xs text-card-foreground/60">
                {['S', 'M', 'T', 'W', 'T', 'F', 'S'][i]}
              </span>
              <Skeleton className="w-8 h-8 rounded-full" />
            </div>
          ))}
        </div>
        <div className="flex justify-between text-xs text-card-foreground/50 mt-2">
          <span>7 days ago</span>
          <span>Today</span>
        </div>
      </div>
      
      {/* Stats Cards */}
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
      
      {/* Account Information Section */}
      <div className="bg-card rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-4">Account Information</h2>
        <div className="space-y-4">
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
      
      {/* Keep spinner for tests */}
      <div className="flex justify-center py-4">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    </div>
  </div>
);

// Wrapper component for pages with error boundary and suspense
const PageWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <PageErrorBoundary>
    <Suspense fallback={<LoadingFallback />}>
      {children}
    </Suspense>
  </PageErrorBoundary>
);

// Wrapper component for ExerciseTypesPage with custom fallback
const ExerciseTypesPageWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <PageErrorBoundary>
    <Suspense fallback={<ExerciseTypesPageFallback />}>
      {children}
    </Suspense>
  </PageErrorBoundary>
);

// Wrapper component for ProfilePage with custom fallback
const ProfilePageWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <PageErrorBoundary>
    <Suspense fallback={<ProfilePageFallback />}>
      {children}
    </Suspense>
  </PageErrorBoundary>
);

const routes: RouteObject[] = [
  {
    path: '/',
    element: <App />,
  },
  {
    path: '/oauth/callback',
    element: (
      <PageWrapper>
        <OAuthCallbackPage />
      </PageWrapper>
    ),
  },
  {
    element: <AppLayout />,
    children: [
      {
        path: 'workouts',
        element: <MyWorkoutsPage />,
      },
      {
        path: 'workouts/:workoutId',
        element: (
          <SimplePageWrapper>
            <WorkoutPage />
          </SimplePageWrapper>
        ),
      },
      {
        path: 'exercise-types',
        element: (
          <ExerciseTypesPageWrapper>
            <ExerciseTypesPage />
          </ExerciseTypesPageWrapper>
        ),
      },
      {
        path: 'exercise-types/:exerciseTypeId',
        element: (
          <PageWrapper>
            <ExerciseTypeDetailsPage />
          </PageWrapper>
        ),
      },
      {
        path: 'routines',
        element: (
          <PageWrapper>
            <RoutinesPage />
          </PageWrapper>
        ),
      },
      {
        path: 'routines/:routineId',
        element: (
          <PageWrapper>
            <RoutineDetailsPage />
          </PageWrapper>
        ),
      },
      {
        path: 'chat',
        element: (
          <SimplePageWrapper>
            <ChatPage />
          </SimplePageWrapper>
        ),
      },
      {
        path: 'profile',
        element: (
          <ProfilePageWrapper>
            <ProfilePage />
          </ProfilePageWrapper>
        ),
      },
      {
        path: 'about',
        element: (
          <PageWrapper>
            <AboutPage />
          </PageWrapper>
        ),
      }
    ]
  },
  {
    path: '*',
    element: (
      <PageWrapper>
        <NotFoundPage />
      </PageWrapper>
    ),
  }
];

export default routes;
