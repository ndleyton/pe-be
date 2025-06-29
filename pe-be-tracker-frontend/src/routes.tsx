import React from 'react';
import { RouteObject } from 'react-router-dom';
import App from './App';
import AppLayout from './layouts/AppLayout';
import MyWorkoutsPage from './pages/MyWorkoutsPage';
import ProfilePage from './pages/ProfilePage';
import { OAuthCallbackPage } from './features/auth/pages';
import WorkoutPage from './pages/WorkoutPage';
import ChatPage from './pages/ChatPage';
import ExerciseTypesPage from './pages/ExerciseTypesPage';
import ExerciseTypeDetailsPage from './pages/ExerciseTypeDetailsPage';
import NotFoundPage from './pages/NotFoundPage';

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
        element: <MyWorkoutsPage />,
      },
      {
        path: 'workouts',
        element: <MyWorkoutsPage />,
      },
      {
        path: 'workout/:workoutId',
        element: <WorkoutPage />,
      },
      {
        path: 'exercise-types',
        element: <ExerciseTypesPage />,
      },
      {
        path: 'exercise-types/:exerciseTypeId',
        element: <ExerciseTypeDetailsPage />,
      },
      {
        path: 'chat',
        element: <ChatPage />,
      },
      {
        path: 'profile',
        element: <ProfilePage />,
      }
    ]
  },
  {
    path: '*',
    element: <NotFoundPage />,
  }
];

export default routes;
