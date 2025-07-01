import React, { lazy, Suspense } from 'react';
import { RouteObject } from 'react-router-dom';
import App from './App';
import AppLayout from './layouts/AppLayout';

const MyWorkoutsPage = lazy(() => import('./pages/MyWorkoutsPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const OAuthCallbackPage = lazy(() => import('./features/auth/pages'));
const WorkoutPage = lazy(() => import('./pages/WorkoutPage'));
const ChatPage = lazy(() => import('./pages/ChatPage'));
const ExerciseTypesPage = lazy(() => import('./pages/ExerciseTypesPage'));
const ExerciseTypeDetailsPage = lazy(() => import('./pages/ExerciseTypeDetailsPage'));
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
      }
    ]
  },
  {
    path: '*',
    element: <Suspense fallback={<div>Loading...</div>}><NotFoundPage /></Suspense>,
  }
];

export default routes;
