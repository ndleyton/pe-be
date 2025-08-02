import React, { Suspense } from 'react';
import { type RouteObject } from 'react-router-dom';
import App from './App';
import AppLayout from './layouts/AppLayout';
import NotFoundPage from './pages/NotFoundPage';
import { PageErrorBoundary } from '@/shared/components/error';

// Lazy load components with error boundaries
const MyWorkoutsPage = React.lazy(() => import('./features/workouts/pages').then(module => ({ default: module.MyWorkoutsPage })));
const WorkoutPage = React.lazy(() => import('./features/workouts/pages').then(module => ({ default: module.WorkoutPage })));
const ExerciseTypesPage = React.lazy(() => import('./features/exercises/pages').then(module => ({ default: module.ExerciseTypesPage })));
const ExerciseTypeDetailsPage = React.lazy(() => import('./features/exercises/pages').then(module => ({ default: module.ExerciseTypeDetailsPage })));
const ChatPage = React.lazy(() => import('./features/chat/pages').then(module => ({ default: module.ChatPage })));
const ProfilePage = React.lazy(() => import('./features/profile/pages').then(module => ({ default: module.ProfilePage })));
const SettingsPage = React.lazy(() => import('./features/settings/pages').then(module => ({ default: module.SettingsPage })));
const OAuthCallbackPage = React.lazy(() => import('./features/auth/pages').then(module => ({ default: module.OAuthCallbackPage })));

// Enhanced loading component with error handling
const LoadingFallback = () => (
  <div className="flex items-center justify-center min-h-[200px]">
    <div className="text-center">
      <div className="loading loading-spinner loading-lg mb-2"></div>
      <div className="text-muted-foreground">Loading...</div>
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
    path: '/',
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
