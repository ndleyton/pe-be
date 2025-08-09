import React, { Suspense } from 'react';
import { type RouteObject } from 'react-router-dom';
import App from './App';
import AppLayout from './layouts/AppLayout';
import NotFoundPage from './pages/NotFoundPage';
import { PageErrorBoundary } from '@/shared/components/error';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { DEFAULT_SKELETON_COUNT } from '@/shared/constants';

// Lazy load components with error boundaries
const MyWorkoutsPage = React.lazy(() => import('./features/workouts/pages').then(module => ({ default: module.MyWorkoutsPage })));
const WorkoutPage = React.lazy(() => import('./features/workouts/pages').then(module => ({ default: module.WorkoutPage })));
const ExerciseTypesPage = React.lazy(() => import('./features/exercises/pages').then(module => ({ default: module.ExerciseTypesPage })));
const ExerciseTypeDetailsPage = React.lazy(() => import('./features/exercises/pages').then(module => ({ default: module.ExerciseTypeDetailsPage })));
const RoutinesPage = React.lazy(() => import('./features/routines/pages/RoutinesPage'));
const RoutineDetailsPage = React.lazy(() => import('./features/routines/pages/RoutineDetailsPage'));
const ChatPage = React.lazy(() => import('./features/chat/pages').then(module => ({ default: module.ChatPage })));
const ProfilePage = React.lazy(() => import('./features/profile/pages').then(module => ({ default: module.ProfilePage })));
const SettingsPage = React.lazy(() => import('./features/settings/pages').then(module => ({ default: module.SettingsPage })));
const OAuthCallbackPage = React.lazy(() => import('./features/auth/pages').then(module => ({ default: module.OAuthCallbackPage })));

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

// Wrapper component for pages with error boundary and suspense
const PageWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <PageErrorBoundary>
    <Suspense fallback={<LoadingFallback />}>
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
        element: (
          <PageWrapper>
            <MyWorkoutsPage />
          </PageWrapper>
        ),
      },
      {
        path: 'workouts/:workoutId',
        element: (
          <PageWrapper>
            <WorkoutPage />
          </PageWrapper>
        ),
      },
      {
        path: 'exercise-types',
        element: (
          <PageWrapper>
            <ExerciseTypesPage />
          </PageWrapper>
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
          <PageWrapper>
            <ChatPage />
          </PageWrapper>
        ),
      },
      {
        path: 'profile',
        element: (
          <PageWrapper>
            <ProfilePage />
          </PageWrapper>
        ),
      },
      {
        path: 'settings',
        element: (
          <PageWrapper>
            <SettingsPage />
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
