import React from 'react';
import { RouteObject } from 'react-router-dom';
import App from './App';
import MyWorkoutsPage from './pages/MyWorkoutsPage';
import OAuthCallbackPage from './pages/OAuthCallbackPage';
import WorkoutPage from './pages/WorkoutPage';

const routes: RouteObject[] = [
  {
    path: '/',
    element: <App />,
  },
  {
    path: '/dashboard',
    element: <MyWorkoutsPage />,
  },
  {
    path: '/oauth/callback',
    element: <OAuthCallbackPage />,
  },
  {
    path: '/workouts',
    element: <MyWorkoutsPage />,
  },
  {
    path: '/workout/:workoutId',
    element: <WorkoutPage />,
  }
];

export default routes;
