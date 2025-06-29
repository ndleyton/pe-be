import React from 'react';
import { RouteObject } from 'react-router-dom';
import App from './App';
import AppLayout from './layouts/AppLayout';
import MyWorkoutsPage from './pages/MyWorkoutsPage';
import { OAuthCallbackPage } from './features/auth/pages';
import WorkoutPage from './pages/WorkoutPage';
import ChatPage from './pages/ChatPage';
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
        path: 'chat',
        element: <ChatPage />,
      },
      {
        path: 'profile',
        element: <div className="p-4"><h1 className="text-2xl font-bold">Profile Page</h1><p>Coming soon...</p></div>,
      }
    ]
  },
  {
    path: '*',
    element: <NotFoundPage />,
  }
];

export default routes;
