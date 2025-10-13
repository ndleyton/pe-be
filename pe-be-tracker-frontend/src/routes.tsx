import React, { Suspense } from 'react';
import { type RouteObject } from 'react-router-dom';

import { Skeleton } from '@/shared/components/ui/skeleton';
import { DEFAULT_SKELETON_COUNT } from '@/shared/constants';
import ExerciseTypesPageSkeleton from '@/features/exercises/components/skeletons/ExerciseTypesPageSkeleton';
import ExerciseTypeDetailsPageSkeleton from '@/features/exercises/components/skeletons/ExerciseTypeDetailsPageSkeleton';
import ProfilePageSkeleton from '@/features/profile/components/skeletons/ProfilePageSkeleton';
import { config } from '@/app/config/env';

import App from './App';
import AppLayout from './layouts/AppLayout';
import NotFoundPage from './pages/NotFoundPage';

// These pages are not lazy loaded as they are core pages
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
const DebugCrashPage = React.lazy(() => import('./features/debug/pages/CrashPage'));

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

// Wrapper component for pages with suspense
const PageWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Suspense fallback={<LoadingFallback />}>
    {children}
  </Suspense>
);

// Wrapper component for ExerciseTypesPage with custom fallback
const ExerciseTypesPageWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Suspense fallback={<ExerciseTypesPageSkeleton />}>
    {children}
  </Suspense>
);

// Wrapper component for ExerciseTypeDetailsPage with custom fallback
const ExerciseTypeDetailsPageWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Suspense fallback={<ExerciseTypeDetailsPageSkeleton />}>
    {children}
  </Suspense>
);

// Wrapper component for ProfilePage with custom fallback
const ProfilePageWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Suspense fallback={<ProfilePageSkeleton />}>
    {children}
  </Suspense>
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
        element: <WorkoutPage />,
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
          <ExerciseTypeDetailsPageWrapper>
            <ExerciseTypeDetailsPage />
          </ExerciseTypeDetailsPageWrapper>
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
        element: <ChatPage />,
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
];

// Development-only debug routes
if (config.isDevelopment) {
  routes.push({
    path: '/debug/crash',
    element: (
      <PageWrapper>
        <DebugCrashPage />
      </PageWrapper>
    ),
  });
}

// catch-all route
routes.push({
  path: '*',
  element: (
    <PageWrapper>
      <NotFoundPage />
    </PageWrapper>
  ),
});

export default routes;
