import React, { lazy, Suspense } from 'react';
import { RouteObject } from 'react-router-dom';
import App from './App';
import AppLayout from './layouts/AppLayout';

const MyWorkoutsPage = lazy(() => import('./features/workouts/pages').then(module => ({ default: module.MyWorkoutsPage })));
const ProfilePage = lazy(() => import('./features/profile/pages').then(module => ({ default: module.ProfilePage })));
const SettingsPage = lazy(() => import('./features/settings/pages').then(module => ({ default: module.SettingsPage })));
const OAuthCallbackPage = lazy(() => import('./features/auth/pages').then(module => ({ default: module.OAuthCallbackPage })));
const WorkoutPage = lazy(() => import('./features/workouts/pages').then(module => ({ default: module.WorkoutPage })));
const ChatPage = lazy(() => import('./features/chat/pages').then(module => ({ default: module.ChatPage })));
const ExerciseTypesPage = lazy(() => import('./features/exercises/pages').then(module => ({ default: module.ExerciseTypesPage })));
const ExerciseTypeDetailsPage = lazy(() => import('./features/exercises/pages').then(module => ({ default: module.ExerciseTypeDetailsPage })));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));

const routes: RouteObject[] = [
  {
    path: '/',
    element: <App />,
  },
  {
    path: '/oauth/callback',
    element: <OAuthCallbackPage />,
  },
  {
    path: '/',
    element: <AppLayout />,
    children: [
      {
        path: 'dashboard',
        element: <Suspense fallback={<div>Loading...</div>}><MyWorkoutsPage /></Suspense>,
      },
      {
        path: 'workouts',
        element: <Suspense fallback={<div>Loading...</div>}><MyWorkoutsPage /></Suspense>,
      },
      {
        path: 'workout/:workoutId',
        element: <Suspense fallback={<div>Loading...</div>}><WorkoutPage /></Suspense>,
      },
      {
        path: 'exercise-types',
        element: <Suspense fallback={<div>Loading...</div>}><ExerciseTypesPage /></Suspense>,
      },
      {
        path: 'exercise-types/:exerciseTypeId',
        element: <Suspense fallback={<div>Loading...</div>}><ExerciseTypeDetailsPage /></Suspense>,
      },
      {
        path: 'chat',
        element: <Suspense fallback={<div>Loading...</div>}><ChatPage /></Suspense>,
      },
      {
        path: 'profile',
        element: <Suspense fallback={<div>Loading...</div>}><ProfilePage /></Suspense>,
      },
      {
        path: 'settings',
        element: <Suspense fallback={<div>Loading...</div>}><SettingsPage /></Suspense>,
      }
    ]
  },
  {
    path: '*',
    element: <Suspense fallback={<div>Loading...</div>}><NotFoundPage /></Suspense>,
  }
];

export default routes;
